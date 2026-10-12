import 'server-only'
import { type SQL, sql } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'

/*
 * Availability SQL (04_data_model.md §6 / §6.1, FR-S-02). One query, no per-slot round trips:
 *   1. generate candidate start minutes per JST day from business_hours (+ overrides),
 *      never offering a start whose [start, start + duration + buffer) crosses closing time;
 *   2. turn them into timestamptz via `AT TIME ZONE 'Asia/Tokyo'` (UTC storage, M-01);
 *   3. classify: inside lead time -> 'deadline'; overlapping an active booking or a
 *      non-deleted block with `&&` -> 'full'; else 'available'.
 * Ranges are half-open '[)', so a booking ending 19:00 does not block a 19:00 start.
 * The day summary and the slot list come from the same CTEs, so they can never disagree.
 * This file lives in lib/db because both features/availability (read DAL) and
 * features/booking (re-check under the advisory lock) use it, and features must not import
 * each other (DES-00 §5.1).
 */

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
      SELECT slot_step_min, lead_time_min, max_advance_days FROM settings WHERE id = 1
    ), m AS (
      SELECT duration_min, buffer_after_min FROM menus WHERE slug = ${menuSlug} AND is_active
    ), p AS (
      SELECT m.duration_min, m.buffer_after_min, s.slot_step_min,
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
             c.start_at < p.not_before AS in_lead_time
      FROM cand c CROSS JOIN p
    ), classified AS (
      SELECT sl.d, sl.start_at,
             CASE WHEN sl.in_lead_time THEN 'deadline'
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

/** §6: each day with every candidate slot and its status (used for the slot list). */
export async function queryAvailabilityDays(
  db: DbOrTx,
  params: AvailabilityParams,
): Promise<RawDay[]> {
  const res = await db.execute<DayRow>(sql`
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
  `)
  return res.rows.map((r) => ({
    date: r.date,
    status: r.day_status,
    closedReason: r.closed_reason,
    slots: (r.slots ?? []).map((s) => ({ startsAt: new Date(s.startsAt), status: s.status })),
  }))
}

/** §6.1: per-day summary for the month calendar (past days are out_of_range). */
export async function queryAvailabilityMonth(
  db: DbOrTx,
  params: AvailabilityParams,
): Promise<Omit<RawDay, 'slots'>[]> {
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
