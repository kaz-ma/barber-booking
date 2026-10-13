import 'server-only'
import { type SQL, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { type Db, type DbOrTx, pool, type Tx } from '@/lib/db'
import * as schema from './schema'
import { withDbRetry } from './transient'

/*
 * Availability SQL (04_data_model.md §6 / §6.1, FR-S-02). One query, no per-slot round trips:
 *   1. generate candidate start minutes per JST day from business_hours (+ overrides),
 *      never offering a start whose [start, start + duration + buffer) crosses closing time;
 *   2. turn them into timestamptz via `AT TIME ZONE 'Asia/Tokyo'` (UTC storage, M-01);
 *   3. classify: inside lead time, or today while settings.allow_same_day is off (CR-02)
 *      -> 'deadline'; overlapping an active booking or a non-deleted block with `&&` -> 'full';
 *      else 'available'.
 * Ranges are half-open '[)', so a booking ending 19:00 does not block a 19:00 start.
 * The day summary and the slot list come from the same CTEs, so they can never disagree.
 * This file lives in lib/db because both features/availability (read DAL) and
 * features/booking (re-check under the advisory lock) use it, and features must not import
 * each other (DES-00 §5.1).
 *
 * JIT (SR-04): the planner over-estimates generate_series rows, the estimated cost crosses
 * jit_above_cost and Postgres JIT-compiles a ~1 ms query for ~0.4 s. Every execution therefore
 * runs inside a transaction with `SET LOCAL jit = off` (works through transaction-mode poolers
 * such as Neon's, unlike startup options or per-session SET): readers use readAvailability(),
 * the booking transaction calls disableJit() itself before the re-check.
 */

/** Turn JIT off for the rest of the current transaction (no-op outside a transaction). */
export async function disableJit(tx: Tx): Promise<void> {
  await tx.execute(sql`SET LOCAL jit = off`)
}

/**
 * Run availability reads in a short read-only transaction with JIT disabled. `BEGIN` and
 * `SET LOCAL` go out as one simple-protocol message, so a read costs three round trips
 * (begin+set, query, commit) instead of five; the database is often far from the function.
 * One retry on a transient connection failure (Neon waking from suspend).
 */
export function readAvailability<T>(fn: (db: DbOrTx) => Promise<T>): Promise<T> {
  return withDbRetry(async () => {
    const client = await pool.connect()
    let ok = false
    try {
      await client.query('BEGIN READ ONLY; SET LOCAL jit = off')
      const result = await fn(drizzle(client, { schema }) as unknown as Db)
      await client.query('COMMIT')
      ok = true
      return result
    } finally {
      if (!ok) await client.query('ROLLBACK').catch(() => {})
      client.release()
    }
  })
}

export type SlotStatus = 'available' | 'full' | 'deadline'
export type DayStatus = SlotStatus | 'closed' | 'out_of_range'
export type ClosedReason = 'regular' | 'override'

export type AvailabilityParams = {
  menuSlug: string
  /** JST calendar dates, inclusive. */
  from: string
  to: string
  now: Date
}

export type RawSlot = { startsAt: Date; status: SlotStatus }
export type RawDay = {
  date: string
  status: DayStatus
  closedReason: ClosedReason | null
  slots: RawSlot[]
}

function availabilityCtes({ menuSlug, from, to, now }: AvailabilityParams): SQL {
  const nowTs = sql`${now.toISOString()}::timestamptz`
  return sql`
    WITH s AS (
      SELECT slot_step_min, lead_time_min, max_advance_days, allow_same_day FROM settings WHERE id = 1
    ), m AS (
      SELECT duration_min, buffer_after_min FROM menus WHERE slug = ${menuSlug} AND is_active
    ), p AS (
      SELECT m.duration_min, m.buffer_after_min, s.slot_step_min, s.allow_same_day,
             ${nowTs} + make_interval(mins => s.lead_time_min)                 AS not_before,
             (${nowTs} AT TIME ZONE 'Asia/Tokyo')::date + s.max_advance_days    AS last_date,
             (${nowTs} AT TIME ZONE 'Asia/Tokyo')::date                         AS today
      FROM m CROSS JOIN s
    ), days AS (
      SELECT d::date AS d FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS d
    ), hours AS (
      SELECT days.d,
             COALESCE(o.is_closed, h.is_closed) AS is_closed,
             COALESCE(o.is_closed, false)       AS override_closed,
             COALESCE(o.open_min,  h.open_min)  AS open_min,
             COALESCE(o.close_min, h.close_min) AS close_min
      FROM days
      JOIN business_hours h ON h.weekday = extract(dow FROM days.d)
      LEFT JOIN business_hour_overrides o ON o.date = days.d
    ), cand AS (
      SELECT hr.d,
             (hr.d::timestamp + make_interval(mins => g.m)) AT TIME ZONE 'Asia/Tokyo' AS start_at
      FROM hours hr
      CROSS JOIN p
      -- ::int casts: generate_series(smallint, smallint, smallint) is ambiguous in Postgres.
      -- Upper bound = close - duration - buffer, so no slot crosses closing time.
      CROSS JOIN LATERAL generate_series(
           hr.open_min::int,
           (hr.close_min - p.duration_min - p.buffer_after_min)::int,
           p.slot_step_min::int) AS g(m)
      WHERE NOT hr.is_closed AND hr.d <= p.last_date
    ), slots AS (
      SELECT c.d, c.start_at,
             tstzrange(c.start_at,
                       c.start_at + make_interval(mins => p.duration_min + p.buffer_after_min),
                       '[)') AS r,
             c.start_at < p.not_before AS in_lead_time,
             (NOT p.allow_same_day AND c.d <= p.today) AS same_day_off
      FROM cand c CROSS JOIN p
    ), classified AS (
      SELECT sl.d, sl.start_at,
             CASE WHEN sl.in_lead_time OR sl.same_day_off THEN 'deadline'
                  WHEN EXISTS (SELECT 1 FROM bookings b
                               WHERE b.resource_id = 1
                                 AND b.status IN ('confirmed', 'arrived', 'in_progress')
                                 AND b.during && sl.r)
                    OR EXISTS (SELECT 1 FROM time_blocks t
                               WHERE t.resource_id = 1 AND t.deleted_at IS NULL
                                 AND t.during && sl.r)
                  THEN 'full'
                  ELSE 'available' END AS slot_status
      FROM slots sl
    )`
}

/** Day status shared by both final SELECTs. `pastIsOutOfRange` is the §6.1 month variant. */
function dayStatusExpr(pastIsOutOfRange: boolean): SQL {
  return sql`
    CASE ${pastIsOutOfRange ? sql`WHEN hr.d < (SELECT today FROM p) THEN 'out_of_range'` : sql``}
         WHEN hr.d > (SELECT last_date FROM p)                         THEN 'out_of_range'
         WHEN hr.is_closed                                             THEN 'closed'
         WHEN count(*) FILTER (WHERE c.slot_status = 'available') > 0 THEN 'available'
         WHEN count(*) FILTER (WHERE c.slot_status = 'full') > 0      THEN 'full'
         WHEN count(c.start_at) > 0                                    THEN 'deadline'
         ELSE 'full' END`
}

type DayRow = {
  date: string
  day_status: DayStatus
  closed_reason: ClosedReason | null
  slots?: { startsAt: string; status: SlotStatus }[]
}

/** §6 SQL (exported for the EXPLAIN test). */
export function availabilityDaysSql(params: AvailabilityParams): SQL {
  return sql`
    ${availabilityCtes(params)}
    SELECT hr.d::text AS date,
           ${dayStatusExpr(false)} AS day_status,
           CASE WHEN hr.override_closed THEN 'override'
                WHEN hr.is_closed       THEN 'regular' END AS closed_reason,
           COALESCE(json_agg(json_build_object('startsAt', c.start_at, 'status', c.slot_status)
                             ORDER BY c.start_at) FILTER (WHERE c.start_at IS NOT NULL),
                    '[]'::json) AS slots
    FROM hours hr
    LEFT JOIN classified c ON c.d = hr.d
    GROUP BY hr.d, hr.is_closed, hr.override_closed
    ORDER BY hr.d
  `
}

/** §6: each day with every candidate slot and its status (used for the slot list). */
export async function queryAvailabilityDays(db: DbOrTx, params: AvailabilityParams): Promise<RawDay[]> {
  const res = await db.execute<DayRow>(availabilityDaysSql(params))
  return res.rows.map((r) => ({
    date: r.date,
    status: r.day_status,
    closedReason: r.closed_reason,
    slots: (r.slots ?? []).map((s) => ({ startsAt: new Date(s.startsAt), status: s.status })),
  }))
}

/** §6.1: per-day summary for the month calendar (past days are out_of_range). */
export async function queryAvailabilityMonth(db: DbOrTx, params: AvailabilityParams): Promise<Omit<RawDay, 'slots'>[]> {
  const res = await db.execute<DayRow>(sql`
    ${availabilityCtes(params)}
    SELECT hr.d::text AS date,
           ${dayStatusExpr(true)} AS day_status,
           CASE WHEN hr.override_closed THEN 'override'
                WHEN hr.is_closed       THEN 'regular' END AS closed_reason
    FROM hours hr
    LEFT JOIN classified c ON c.d = hr.d
    GROUP BY hr.d, hr.is_closed, hr.override_closed
    ORDER BY hr.d
  `)
  return res.rows.map((r) => ({ date: r.date, status: r.day_status, closedReason: r.closed_reason }))
}

type MonthSlotRow = {
  date: string
  day_status: DayStatus
  closed_reason: ClosedReason | null
  slots: string[] | null
  today: string | null
  last_date: string | null
}

export type MonthSlots = {
  /** JST today and the last bookable date (null when the menu is unknown or inactive). */
  today: string | null
  lastDate: string | null
  days: (Omit<RawDay, 'slots'> & { open: Date[] })[]
}

/**
 * §6.1 month summary plus the bookable start times of every day, in one query: the booking
 * page switches days on the client without asking again. Past days are out_of_range.
 */
export async function queryMonthWithSlots(db: DbOrTx, params: AvailabilityParams): Promise<MonthSlots> {
  const res = await db.execute<MonthSlotRow>(sql`
    ${availabilityCtes(params)}
    SELECT hr.d::text AS date,
           ${dayStatusExpr(true)} AS day_status,
           CASE WHEN hr.override_closed THEN 'override'
                WHEN hr.is_closed       THEN 'regular' END AS closed_reason,
           CASE WHEN hr.d < (SELECT today FROM p) THEN NULL
                ELSE json_agg(c.start_at ORDER BY c.start_at) FILTER (WHERE c.slot_status = 'available')
           END AS slots,
           (SELECT today FROM p)::text     AS today,
           (SELECT last_date FROM p)::text AS last_date
    FROM hours hr
    LEFT JOIN classified c ON c.d = hr.d
    GROUP BY hr.d, hr.is_closed, hr.override_closed
    ORDER BY hr.d
  `)
  const first = res.rows[0]
  return {
    today: first?.today ?? null,
    lastDate: first?.last_date ?? null,
    days: res.rows.map((r) => ({
      date: r.date,
      status: r.day_status,
      closedReason: r.closed_reason,
      open: (r.slots ?? []).map((s) => new Date(s)),
    })),
  }
}
