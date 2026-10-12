import 'server-only'
import { sql } from 'drizzle-orm'
import { formatDateJa, jstInstant } from '@/domain/jst-format'
import { addDays, jstDate, jstTime } from '@/domain/time'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { countUnacknowledged } from '@/lib/notify'
import { sendPushToAll } from '@/lib/push'
import { buildDeclarativePayload, digestTopic } from '@/lib/push-payload'
import { absoluteUrl } from '@/lib/site'

/*
 * Daily digest (FR-A-12, AT-23, 05_state_and_flows.md §5). Vercel Cron `0 12 * * *` = 21:00 JST
 * (Hobby: anywhere in 21:00-21:59). The INSERT into daily_digests (PK = JST send date) comes
 * first: a second run on the same day inserts nothing and sends nothing. Push failures are
 * logged in notification_log and still answer 200 (no reliance on cron retries).
 * Also sends on zero-booking days (liveness signal). Body has counts and times only.
 */

export type DigestResult = { result: 'sent' | 'skipped'; count: number }

export async function runDailyDigest(now: Date = new Date()): Promise<DigestResult> {
  const today = jstDate(now)
  const target = addDays(today, 1)
  const inserted = await db.execute<{ digest_sent_on: string }>(sql`
    INSERT INTO daily_digests (digest_sent_on, target_date, booking_count, sent_at)
    VALUES (${today}::date, ${target}::date, 0, ${now.toISOString()}::timestamptz)
    ON CONFLICT (digest_sent_on) DO NOTHING
    RETURNING digest_sent_on
  `)
  if (inserted.rows.length === 0) return { result: 'skipped', count: 0 }

  const stats = await db.execute<{ n: number; first_at: string | null; last_at: string | null }>(sql`
    SELECT count(*)::int AS n, min(lower(during)) AS first_at, max(lower(during)) AS last_at
    FROM bookings
    WHERE status IN ('confirmed', 'arrived', 'in_progress') AND deleted_at IS NULL
      AND lower(during) >= ${jstInstant(target, 0).toISOString()}::timestamptz
      AND lower(during) <  ${jstInstant(target, 1440).toISOString()}::timestamptz
  `)
  const s = stats.rows[0] ?? { n: 0, first_at: null, last_at: null }
  await db.execute(sql`UPDATE daily_digests SET booking_count = ${s.n} WHERE digest_sent_on = ${today}::date`)

  const closed = await db.execute<{ closed: boolean; override_closed: boolean }>(sql`
    SELECT COALESCE(o.is_closed, h.is_closed) AS closed, COALESCE(o.is_closed, false) AS override_closed
    FROM business_hours h LEFT JOIN business_hour_overrides o ON o.date = ${target}::date
    WHERE h.weekday = extract(dow FROM ${target}::date)
  `)
  const isClosed = closed.rows[0]?.closed ?? false
  // A temporary closure (override) is not the regular holiday (CR-16).
  const closedLabel = closed.rows[0]?.override_closed ? '明日は臨時休業日です' : '明日は定休日です'
  const day = formatDateJa(target, 'half')
  let body: string
  if (s.n > 0 && s.first_at && s.last_at) {
    const first = jstTime(new Date(s.first_at))
    const last = jstTime(new Date(s.last_at))
    body = first === last ? `${first} 開始` : `${first}〜${last} 開始`
  } else {
    body = isClosed ? `${closedLabel}（予約 0 件）` : '明日の予約はありません'
  }
  const payload = buildDeclarativePayload({
    title: `明日 ${day} の予約 ${s.n} 件`,
    body,
    navigate: absoluteUrl(`/admin?date=${target}`),
    tag: `digest-${target}`,
    data: { kind: 'digest', date: target, count: s.n },
    badge: await countUnacknowledged(),
  })
  await sendPushToAll(payload, {
    template: 'daily_digest',
    scheduledFor: now,
    urgency: 'normal',
    topic: digestTopic(target),
    now,
  })

  logger.info('daily_digest.sent', { targetDate: target, count: s.n })
  return { result: 'sent', count: s.n }
}
