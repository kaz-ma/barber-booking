import 'server-only'
import { sql } from 'drizzle-orm'
import { toJstIso } from '@/domain/time'
import { db } from '@/lib/db'
import { hashCancelToken, hashesEqual, isCancelTokenFormat } from '@/lib/tokens'
import { VIEW_GRACE_MS } from './service'

/** Token page DTO (06_api.md §2.2). Never includes token hashes, idempotency keys, IP or UA. */
export type BookingByTokenDTO = {
  /** Internal id, used server-side only for the ICS UID. */
  id: string
  publicCode: string
  menuName: { ja: string; en: string }
  /** JST ISO strings. `end` excludes the buffer (display end). */
  start: string
  end: string
  priceJpy: number
  isStudent: boolean
  locale: 'ja' | 'en'
  canCancel: boolean
  deadline: string
  /**
   * "Until N hours before" as fixed for this booking (start − cancel_token_expires_at), not the
   * current setting, which may have changed since (CR-17).
   */
  cancelDeadlineHours: number
}

type Row = {
  id: string
  public_code: string
  status: string
  /** timestamptz arrive as strings from drizzle's node-postgres session */
  start_at: string
  end_at: string
  buffer_min: number
  price_jpy: number
  is_student: boolean
  locale: 'ja' | 'en'
  cancel_token_hash: Buffer
  cancel_token_expires_at: string
  name_ja: string
  name_en: string
}

/** Uncached (callers use `await connection()`): depends on the token and the current state. */
export async function getBookingByToken(token: string, now: Date = new Date()): Promise<BookingByTokenDTO | null> {
  if (!isCancelTokenFormat(token)) return null
  const hash = hashCancelToken(token)
  const res = await db.execute<Row>(sql`
    SELECT b.id, b.public_code, b.status, lower(b.during) AS start_at, upper(b.during) AS end_at,
           b.buffer_min, b.price_jpy, b.is_student, b.locale, b.cancel_token_hash,
           b.cancel_token_expires_at, m.name_ja, m.name_en
    FROM bookings b JOIN menus m ON m.id = b.menu_id
    WHERE b.cancel_token_hash = ${hash} AND b.deleted_at IS NULL
  `)
  const row = res.rows[0]
  if (!row || !hashesEqual(row.cancel_token_hash, hash)) return null
  const endAt = new Date(row.end_at)
  if (row.status !== 'confirmed' || now.getTime() >= endAt.getTime() + VIEW_GRACE_MS) return null
  const deadline = new Date(row.cancel_token_expires_at)
  return {
    id: row.id,
    publicCode: row.public_code,
    menuName: { ja: row.name_ja, en: row.name_en },
    start: toJstIso(new Date(row.start_at)),
    end: toJstIso(new Date(endAt.getTime() - row.buffer_min * 60_000)),
    priceJpy: row.price_jpy,
    isStudent: row.is_student,
    locale: row.locale,
    canCancel: now.getTime() < deadline.getTime(),
    deadline: toJstIso(deadline),
    cancelDeadlineHours: Math.round(((new Date(row.start_at).getTime() - deadline.getTime()) / 3_600_000) * 100) / 100,
  }
}
