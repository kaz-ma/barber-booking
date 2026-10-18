import 'server-only'
import { sql } from 'drizzle-orm'
import { jstDate } from '@/domain/time'
import type { ActionResult } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { db, type Tx } from '@/lib/db'
import { lockCalendar } from './calendar'

/*
 * B7 毎週の休憩 (2026-10-18). A rule ("火〜日 21:00–21:30 休憩") becomes one time_blocks row per
 * matching open day up to the booking horizon, so availability keeps reading time_blocks only.
 * Rows are (re)filled when the rule is saved and nightly; a day the owner deleted stays deleted
 * (unique per rule and start), days with an active booking or another block are skipped.
 */

type Ctx = { now?: Date }

export type RecurringBlock = {
  id: string
  weekdays: number[]
  startMin: number
  endMin: number
  kind: string
  label: string | null
}

const maskOf = (weekdays: number[]) => weekdays.reduce((m, d) => m | (1 << d), 0)
const weekdaysOf = (mask: number) => [0, 1, 2, 3, 4, 5, 6].filter((d) => (mask >> d) & 1)

/** Fills the horizon for one rule (or all rules). Returns how many day rows were created. */
async function materialize(tx: Tx, now: Date, ruleId: string | null): Promise<number> {
  const today = jstDate(now)
  const res = await tx.execute<{ id: string }>(sql`
    INSERT INTO time_blocks (resource_id, during, kind, label, recurring_id)
    SELECT 1, tstzrange(t.s, t.e, '[)'), r.kind, r.label, r.id
    FROM recurring_blocks r
    CROSS JOIN settings st
    CROSS JOIN LATERAL generate_series(${today}::date, ${today}::date + st.max_advance_days, interval '1 day') AS g(day)
    CROSS JOIN LATERAL (
      SELECT (g.day::date + make_interval(mins => r.start_min)) AT TIME ZONE 'Asia/Tokyo' AS s,
             (g.day::date + make_interval(mins => r.end_min)) AT TIME ZONE 'Asia/Tokyo' AS e
    ) t
    JOIN business_hours h ON h.weekday = extract(dow FROM g.day)::int AND NOT h.is_closed
    WHERE r.deleted_at IS NULL
      AND (${ruleId}::uuid IS NULL OR r.id = ${ruleId}::uuid)
      AND (r.weekday_mask >> extract(dow FROM g.day)::int) & 1 = 1
      AND t.e > ${now.toISOString()}::timestamptz
      AND NOT EXISTS (
        SELECT 1 FROM bookings b WHERE b.deleted_at IS NULL AND b.status IN ('confirmed', 'arrived', 'in_progress')
          AND b.during && tstzrange(t.s, t.e, '[)'))
      AND NOT EXISTS (
        SELECT 1 FROM time_blocks x WHERE x.deleted_at IS NULL AND x.during && tstzrange(t.s, t.e, '[)'))
    ON CONFLICT (recurring_id, lower(during)) WHERE recurring_id IS NOT NULL DO NOTHING
    RETURNING id`)
  return res.rows.length
}

export async function createRecurringBlock(
  input: { weekdays: number[]; startMin: number; endMin: number; kind: string; label?: string | undefined },
  ctx: Ctx = {},
): Promise<ActionResult<{ ruleId: string; created: number }>> {
  const now = ctx.now ?? new Date()
  return db.transaction(async (tx) => {
    await lockCalendar(tx)
    const res = await tx.execute<{ id: string }>(sql`
      INSERT INTO recurring_blocks (weekday_mask, start_min, end_min, kind, label)
      VALUES (${maskOf(input.weekdays)}, ${input.startMin}, ${input.endMin}, ${input.kind}::block_kind, ${input.label ?? null})
      RETURNING id`)
    const ruleId = res.rows[0]?.id
    if (!ruleId) throw new Error('recurring insert returned no row')
    const created = await materialize(tx, now, ruleId)
    await audit(tx, {
      actor: 'owner',
      action: 'time_block.recurring_create',
      entityType: 'time_block',
      entityId: ruleId,
      diff: { mask: maskOf(input.weekdays), startMin: input.startMin, endMin: input.endMin, kind: input.kind, created },
    })
    return { status: 'ok', data: { ruleId, created } }
  })
}

/** Stops a rule: the rule and its days from now on are removed; past days stay as they were. */
export async function deleteRecurringBlock(ruleId: string, ctx: Ctx = {}): Promise<ActionResult<{ removed: number }>> {
  const now = (ctx.now ?? new Date()).toISOString()
  return db.transaction(async (tx) => {
    await lockCalendar(tx)
    const rule = await tx.execute<{ id: string }>(sql`
      UPDATE recurring_blocks SET deleted_at = ${now}::timestamptz
      WHERE id = ${ruleId} AND deleted_at IS NULL RETURNING id`)
    if (rule.rows.length === 0) return { status: 'not_found' }
    const removed = await tx.execute<{ id: string }>(sql`
      UPDATE time_blocks SET deleted_at = ${now}::timestamptz
      WHERE recurring_id = ${ruleId} AND deleted_at IS NULL AND upper(during) > ${now}::timestamptz
      RETURNING id`)
    await audit(tx, {
      actor: 'owner',
      action: 'time_block.recurring_delete',
      entityType: 'time_block',
      entityId: ruleId,
      diff: { removed: removed.rows.length },
    })
    return { status: 'ok', data: { removed: removed.rows.length } }
  })
}

export async function listRecurringBlocks(): Promise<RecurringBlock[]> {
  const res = await db.execute<{
    id: string
    weekday_mask: number
    start_min: number
    end_min: number
    kind: string
    label: string | null
  }>(sql`
    SELECT id, weekday_mask, start_min, end_min, kind, label FROM recurring_blocks
    WHERE deleted_at IS NULL ORDER BY start_min, created_at`)
  return res.rows.map((r) => ({
    id: r.id,
    weekdays: weekdaysOf(r.weekday_mask),
    startMin: r.start_min,
    endMin: r.end_min,
    kind: r.kind,
    label: r.label,
  }))
}

/** Nightly top-up so the horizon keeps moving (cron). */
export async function materializeRecurringBlocks(now: Date = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    await lockCalendar(tx)
    return materialize(tx, now, null)
  })
}
