import 'server-only'
import { sql } from 'drizzle-orm'
import type { ActionResult } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { db } from '@/lib/db'
import { escapeText, fold, utcStamp } from '@/lib/ics-text'
import { absoluteUrl, siteUrl } from '@/lib/site'
import { hashCancelToken, hashesEqual, isCancelTokenFormat, issueCancelToken } from '@/lib/tokens'

/*
 * B8 iPhone カレンダー連携 (2026-10-18): a private iCalendar feed the owner subscribes to
 * (webcal://…/api/calendar/{token}). The token is 32 random bytes shown once; only its SHA-256
 * is kept (AGENTS.md rule 5). Events carry the menu only — no customer names, since the feed
 * is synced to the phone's calendar account — and link back to the booking in the admin app.
 */

export async function hasCalendarFeed(): Promise<boolean> {
  const res = await db.execute<{ on: boolean }>(
    sql`SELECT calendar_feed_token_hash IS NOT NULL AS on FROM settings WHERE id = 1`,
  )
  return res.rows[0]?.on ?? false
}

/** Issues (or replaces) the feed token; the previous subscription URL stops working. */
export async function issueCalendarFeed(): Promise<ActionResult<{ webcalUrl: string; httpsUrl: string }>> {
  const token = issueCancelToken()
  await db.transaction(async (tx) => {
    await tx.execute(sql`UPDATE settings SET calendar_feed_token_hash = ${token.hash} WHERE id = 1`)
    await audit(tx, {
      actor: 'owner',
      action: 'settings.calendar_feed',
      entityType: 'settings',
      entityId: '1',
      diff: { on: true },
    })
  })
  const httpsUrl = absoluteUrl(`/api/calendar/${token.raw}`)
  return { status: 'ok', data: { httpsUrl, webcalUrl: httpsUrl.replace(/^https?:/, 'webcal:') } }
}

export async function revokeCalendarFeed(): Promise<ActionResult<null>> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`UPDATE settings SET calendar_feed_token_hash = NULL WHERE id = 1`)
    await audit(tx, {
      actor: 'owner',
      action: 'settings.calendar_feed',
      entityType: 'settings',
      entityId: '1',
      diff: { on: false },
    })
  })
  return { status: 'ok', data: null }
}

const STATUS_NOTE: Record<string, string> = { in_progress: '（施術中）', completed: '（終了）' }

/** The feed for a valid token, else null. Two weeks back to the end of the booking horizon. */
export async function buildCalendarFeed(rawToken: string, now: Date = new Date()): Promise<string | null> {
  if (!isCancelTokenFormat(rawToken)) return null
  const res = await db.execute<{ hash: Buffer | null; max_days: number }>(
    sql`SELECT calendar_feed_token_hash AS hash, max_advance_days AS max_days FROM settings WHERE id = 1`,
  )
  const s = res.rows[0]
  const hash = hashCancelToken(rawToken)
  if (!s?.hash || !hashesEqual(Buffer.from(s.hash), hash)) return null
  const t = now.toISOString()
  const rows = await db.execute<{ id: string; start_at: string; end_at: string; status: string; menu: string }>(sql`
    SELECT b.id, lower(b.during) AS start_at, upper(b.during) - make_interval(mins => b.buffer_min) AS end_at,
           b.status, m.name_ja AS menu
    FROM bookings b JOIN menus m ON m.id = b.menu_id
    WHERE b.deleted_at IS NULL AND b.status IN ('confirmed', 'arrived', 'in_progress', 'completed')
      AND upper(b.during) > ${t}::timestamptz - interval '14 days'
      AND lower(b.during) < ${t}::timestamptz + make_interval(days => ${s.max_days + 1})
    ORDER BY lower(b.during)`)
  const host = new URL(siteUrl()).host
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neuer Barber//Owner feed//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText('Neuer Barber 予約')}`,
    'X-WR-TIMEZONE:Asia/Tokyo',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ]
  for (const r of rows.rows) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:owner-${r.id}@${host}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(new Date(r.start_at))}`,
      `DTEND:${utcStamp(new Date(r.end_at))}`,
      `SUMMARY:${escapeText(`予約 ${r.menu}${STATUS_NOTE[r.status] ?? ''}`)}`,
      `DESCRIPTION:${escapeText('管理画面で開く')}`,
      `URL:${absoluteUrl(`/admin/bookings/${r.id}`)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}
