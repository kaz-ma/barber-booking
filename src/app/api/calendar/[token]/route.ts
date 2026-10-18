import { connection, type NextRequest } from 'next/server'
import { buildCalendarFeed } from '@/features/admin/calendar-feed'
import { clientIp } from '@/lib/client-ip'
import { hitWindow, LIMITS, rateKeys } from '@/lib/rate-limit'
import { guardRoute } from '@/lib/unexpected-error'

const FEED_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

/** GET /api/calendar/[token] (B8): the owner's private calendar subscription. */
export async function GET(request: NextRequest, { params }: RouteContext<'/api/calendar/[token]'>): Promise<Response> {
  return guardRoute('calendar_feed.failed', async () => {
    await connection()
    const { windowSec, limit } = LIMITS.calendarIp
    const rate = await hitWindow(rateKeys.calendarIp(clientIp(request.headers)), windowSec, limit)
    if (!rate.ok) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { ...FEED_HEADERS, 'Retry-After': String(rate.retryAfterSec) },
      })
    }
    const { token } = await params
    const feed = await buildCalendarFeed(token.replace(/\.ics$/, ''))
    if (!feed) return new Response('Not Found', { status: 404, headers: FEED_HEADERS })
    return new Response(feed, {
      headers: { ...FEED_HEADERS, 'Content-Type': 'text/calendar; charset=utf-8' },
    })
  })
}
