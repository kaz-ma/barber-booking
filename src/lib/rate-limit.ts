import 'server-only'
import { type SQL, sql } from 'drizzle-orm'
import { type DbOrTx, db as defaultDb } from '@/lib/db'
import { piiHmac } from '@/lib/hash'

/**
 * Fixed-window rate limits in Postgres (08_security.md §6.1, FR-S-04). No extra service.
 * Fixed windows allow up to 2x burst at a boundary; acceptable at this scale.
 * `now` is injectable (AGENTS.md rule 10, CR-18): tests pin the window instead of racing the
 * real clock across a 10-minute / JST-day boundary.
 */
export const LIMITS = {
  bookingIp: { windowSec: 600, limit: 5 },
  bookingPhonePerJstDay: 3,
  cancelIp: { windowSec: 60, limit: 10 },
  /** /api/csp-report: browsers batch reports; anything above this is noise (SR-11). */
  cspReportIp: { windowSec: 60, limit: 20 },
} as const

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number }
export type RateOpts = { db?: DbOrTx; now?: Date }

export const rateKeys = {
  bookingIp: (ip: string) => `book:ip:${piiHmac(ip)}`,
  bookingPhone: (e164: string) => `book:phone:${piiHmac(e164)}`,
  cancelIp: (ip: string) => `cancel:ip:${piiHmac(ip)}`,
  cspReportIp: (ip: string) => `csp:ip:${piiHmac(ip)}`,
}

const nowSql = (now?: Date): SQL => (now ? sql`${now.toISOString()}::timestamptz` : sql`now()`)

/** Increment the current window and report whether the caller is still within `limit`. */
export async function hitWindow(
  key: string,
  windowSec: number,
  limit: number,
  opts: RateOpts = {},
): Promise<RateResult> {
  const db = opts.db ?? defaultDb
  const now = nowSql(opts.now)
  const res = await db.execute<{ count: number; retry_after: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, to_timestamp(floor(extract(epoch FROM ${now}) / ${windowSec}) * ${windowSec}), 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count,
      ceil(extract(epoch FROM (window_start + make_interval(secs => ${windowSec}) - ${now})))::int AS retry_after
  `)
  const row = res.rows[0]
  if (!row || row.count <= limit) return { ok: true }
  return { ok: false, retryAfterSec: Math.max(1, row.retry_after) }
}

const jstDayStart = (now: SQL) =>
  sql`((((${now}) AT TIME ZONE 'Asia/Tokyo')::date)::timestamp AT TIME ZONE 'Asia/Tokyo')`

/**
 * Check only. The booking transaction calls this again under the calendar advisory lock and
 * increments in the same transaction (SR-02 / CR-08), so concurrent submissions for one phone
 * are serialised; the call outside the transaction is only an early, cheap rejection.
 */
export async function checkPhoneDaily(e164: string, opts: RateOpts = {}): Promise<RateResult> {
  const db = opts.db ?? defaultDb
  const now = nowSql(opts.now)
  const res = await db.execute<{ total: number; retry_after: number }>(sql`
    SELECT coalesce(sum(count), 0)::int AS total,
           ceil(extract(epoch FROM (${jstDayStart(now)} + interval '1 day' - ${now})))::int AS retry_after
    FROM rate_limits
    WHERE key = ${rateKeys.bookingPhone(e164)} AND window_start = ${jstDayStart(now)}
  `)
  const row = res.rows[0]
  if (!row || row.total < LIMITS.bookingPhonePerJstDay) return { ok: true }
  return { ok: false, retryAfterSec: Math.max(1, row.retry_after) }
}

export async function incrementPhoneDaily(e164: string, opts: RateOpts & { db: DbOrTx }): Promise<void> {
  const now = nowSql(opts.now)
  await opts.db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${rateKeys.bookingPhone(e164)}, ${jstDayStart(now)}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
  `)
}
