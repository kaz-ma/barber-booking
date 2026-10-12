import 'server-only'
import { sql } from 'drizzle-orm'
import { type DbOrTx, db as defaultDb } from '@/lib/db'
import { piiHmac } from '@/lib/hash'

/**
 * Fixed-window rate limits in Postgres (08_security.md §6.1, FR-S-04). No extra service.
 * Fixed windows allow up to 2x burst at a boundary; acceptable at this scale.
 */
export const LIMITS = {
  bookingIp: { windowSec: 600, limit: 5 },
  bookingPhonePerJstDay: 3,
  cancelIp: { windowSec: 60, limit: 10 },
} as const

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number }

export const rateKeys = {
  bookingIp: (ip: string) => `book:ip:${piiHmac(ip)}`,
  bookingPhone: (e164: string) => `book:phone:${piiHmac(e164)}`,
  cancelIp: (ip: string) => `cancel:ip:${piiHmac(ip)}`,
}

/** Increment the current window and report whether the caller is still within `limit`. */
export async function hitWindow(
  key: string,
  windowSec: number,
  limit: number,
  db: DbOrTx = defaultDb,
): Promise<RateResult> {
  const res = await db.execute<{ count: number; retry_after: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, to_timestamp(floor(extract(epoch FROM now()) / ${windowSec}) * ${windowSec}), 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count,
      ceil(extract(epoch FROM (window_start + make_interval(secs => ${windowSec}) - now())))::int AS retry_after
  `)
  const row = res.rows[0]
  if (!row || row.count <= limit) return { ok: true }
  return { ok: false, retryAfterSec: Math.max(1, row.retry_after) }
}

const jstDayStart = sql`(((now() AT TIME ZONE 'Asia/Tokyo')::date)::timestamp AT TIME ZONE 'Asia/Tokyo')`

/** Check only (the phone counter is incremented inside the booking transaction on success). */
export async function checkPhoneDaily(e164: string, db: DbOrTx = defaultDb): Promise<RateResult> {
  const res = await db.execute<{ total: number; retry_after: number }>(sql`
    SELECT coalesce(sum(count), 0)::int AS total,
           ceil(extract(epoch FROM (${jstDayStart} + interval '1 day' - now())))::int AS retry_after
    FROM rate_limits
    WHERE key = ${rateKeys.bookingPhone(e164)} AND window_start = ${jstDayStart}
  `)
  const row = res.rows[0]
  if (!row || row.total < LIMITS.bookingPhonePerJstDay) return { ok: true }
  return { ok: false, retryAfterSec: Math.max(1, row.retry_after) }
}

export async function incrementPhoneDaily(e164: string, db: DbOrTx): Promise<void> {
  await db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${rateKeys.bookingPhone(e164)}, ${jstDayStart}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
  `)
}
