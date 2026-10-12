import 'server-only'
import { sql } from 'drizzle-orm'
import { toJstIso } from '@/domain/time'
import type { DbOrTx, Tx } from '@/lib/db'
import type { HoursForDate, OverlapDTO } from './types'

/*
 * Calendar helpers shared by the admin service and DAL. Every calendar write takes the same
 * advisory lock as the public booking pipeline (ADR-0003, 05 §2.1): READ COMMITTED +
 * pg_advisory_xact_lock(hashtext('calendar'), resource) serialises bookings, blocks and undo.
 */

export const RESOURCE_ID = 1

export async function lockCalendar(tx: Tx): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('calendar'), ${RESOURCE_ID})`)
}

export const BLOCK_KIND_LABELS: Record<string, string> = {
  break: '休憩',
  private: '私用',
  closed: '臨時休業',
  holiday: '休業日',
}

type OverlapRow = { kind: 'booking' | 'block'; id: string; start_at: string; end_at: string; label: string }

/**
 * Active bookings (and optionally non-deleted blocks) intersecting [start, end). Half-open
 * ranges: touching intervals never overlap — the same rule as the EXCLUDE constraint.
 * Booking end is the display end (without buffer) for the label, but the test uses `during`.
 */
export async function findOverlaps(
  db: DbOrTx,
  start: Date,
  end: Date,
  opts: { includeBlocks: boolean; excludeBookingId?: string },
): Promise<OverlapDTO[]> {
  const range = sql`tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)')`
  const exclude = opts.excludeBookingId ? sql`AND b.id <> ${opts.excludeBookingId}` : sql``
  const blocks = opts.includeBlocks
    ? sql`UNION ALL
       SELECT 'block' AS kind, t.id::text, lower(t.during) AS start_at, upper(t.during) AS end_at,
              coalesce(t.kind::text, '') || CASE WHEN t.label IS NOT NULL THEN ':' || t.label ELSE '' END AS label
       FROM time_blocks t
       WHERE t.resource_id = ${RESOURCE_ID} AND t.deleted_at IS NULL AND t.during && ${range}`
    : sql``
  const res = await db.execute<OverlapRow>(sql`
    SELECT 'booking' AS kind, b.id::text, lower(b.during) AS start_at,
           upper(b.during) - make_interval(mins => b.buffer_min) AS end_at,
           coalesce(c.name, '') AS label
    FROM bookings b JOIN customers c ON c.id = b.customer_id
    WHERE b.resource_id = ${RESOURCE_ID} AND b.status IN ('confirmed', 'arrived', 'in_progress')
      AND b.during && ${range} ${exclude}
    ${blocks}
    ORDER BY start_at
  `)
  return res.rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    start: toJstIso(new Date(r.start_at)),
    end: toJstIso(new Date(r.end_at)),
    label: r.kind === 'booking' ? (r.label ? `${r.label}様` : 'お客様') : blockLabel(r.label),
  }))
}

function blockLabel(raw: string): string {
  const [kind = '', ...rest] = raw.split(':')
  const base = BLOCK_KIND_LABELS[kind] ?? 'ブロック'
  return rest.length > 0 ? `${base}（${rest.join(':')}）` : base
}

/** Opening hours of a JST date: override first, then the weekday template. */
export async function hoursForDate(db: DbOrTx, date: string): Promise<HoursForDate> {
  const res = await db.execute<{
    is_closed: boolean
    open_min: number | null
    close_min: number | null
    is_override: boolean
  }>(sql`
    SELECT COALESCE(o.is_closed, h.is_closed) AS is_closed,
           COALESCE(o.open_min, h.open_min)   AS open_min,
           COALESCE(o.close_min, h.close_min) AS close_min,
           (o.date IS NOT NULL)               AS is_override
    FROM business_hours h
    LEFT JOIN business_hour_overrides o ON o.date = ${date}::date
    WHERE h.weekday = extract(dow FROM ${date}::date)
  `)
  const r = res.rows[0]
  if (!r) return { isClosed: true, openMin: null, closeMin: null, isOverride: false }
  return {
    isClosed: r.is_closed,
    openMin: r.is_closed ? null : r.open_min,
    closeMin: r.is_closed ? null : r.close_min,
    isOverride: r.is_override,
  }
}
