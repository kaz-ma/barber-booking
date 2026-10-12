import 'server-only'
import { sql } from 'drizzle-orm'
import { formatDateJa, formatRangeJa } from '@/domain/jst-format'
import { jstDate, jstTime } from '@/domain/time'
import { type DbOrTx, db as defaultDb } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendPushToAll } from '@/lib/push'
import { bookingTopic, buildDeclarativePayload } from '@/lib/push-payload'
import { absoluteUrl } from '@/lib/site'

export type OwnerNotification = 'booking_created' | 'booking_cancelled'

/**
 * Inbox definition (03_screen_specs.md §6.2, FR-A-11): not yet acknowledged AND (a web booking
 * or a customer cancellation). Manual bookings are acknowledged on insert.
 */
export const UNACKNOWLEDGED_WHERE = sql`acknowledged_at IS NULL AND deleted_at IS NULL
  AND (status = 'cancelled_by_customer' OR (source = 'web' AND status IN ('confirmed', 'arrived', 'in_progress')))`

export async function countUnacknowledged(db: DbOrTx = defaultDb): Promise<number> {
  const res = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM bookings WHERE ${UNACKNOWLEDGED_WHERE}`,
  )
  return res.rows[0]?.n ?? 0
}

export const SOURCE_LABELS: Record<string, string> = {
  web: 'web',
  phone: '電話',
  walk_in: '店頭',
  instagram: 'Instagram',
  line: 'LINE',
  manual: 'その他',
}

type Row = {
  id: string
  start_at: string
  end_at: string
  buffer_min: number
  source: string
  created_at: string
  cancelled_at: string | null
  menu_name: string
}

/**
 * Owner push, called from `after()` so it never affects the booking result (FR-S-03).
 * Payload: date, time, menu, source and the unread count only — no name, phone or note
 * (AGENTS.md rule 6, NFR-SC-07). Never throws.
 */
export async function notifyOwner(kind: OwnerNotification, bookingId: string): Promise<void> {
  try {
    const res = await defaultDb.execute<Row>(sql`
      SELECT b.id, lower(b.during) AS start_at, upper(b.during) AS end_at, b.buffer_min, b.source,
             b.created_at, b.cancelled_at, m.name_ja AS menu_name
      FROM bookings b JOIN menus m ON m.id = b.menu_id WHERE b.id = ${bookingId}
    `)
    const row = res.rows[0]
    if (!row) return
    const start = new Date(row.start_at)
    const end = new Date(new Date(row.end_at).getTime() - row.buffer_min * 60_000)
    const day = formatDateJa(jstDate(start), 'half')
    const range = formatRangeJa(start, end)
    const unread = await countUnacknowledged()
    const created = kind === 'booking_created'
    const payload = buildDeclarativePayload({
      title: `${created ? '新規予約' : 'キャンセル'} ${day} ${jstTime(start)} ${row.menu_name}`,
      body: created
        ? `${range}（${SOURCE_LABELS[row.source] ?? row.source}）・未確認 ${unread} 件`
        : `お客様がキャンセルしました（${range}）・未確認 ${unread} 件`,
      navigate: absoluteUrl(`/admin/bookings/${row.id}`),
      tag: `booking-${row.id}`,
      data: { bookingId: row.id, kind: created ? 'created' : 'cancelled' },
      badge: unread,
    })
    await sendPushToAll(payload, {
      template: kind,
      bookingId: row.id,
      scheduledFor: new Date(created ? row.created_at : (row.cancelled_at ?? row.created_at)),
      urgency: 'high',
      topic: bookingTopic(row.id),
    })
  } catch (err) {
    logger.error('notify_owner.failed', { kind, bookingId, error: err instanceof Error ? err.message : 'unknown' })
  }
}
