import { connection, type NextRequest } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { shop } from '@/config/shop'
import { buildIcs } from '@/features/booking/ics'
import { getBookingByToken } from '@/features/booking/queries'
import { clientIp } from '@/lib/client-ip'
import { hitWindow, LIMITS, rateKeys } from '@/lib/rate-limit'
import { absoluteUrl, siteUrl } from '@/lib/site'
import { guardRoute } from '@/lib/unexpected-error'

const TOKEN_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

/** GET /api/ics/[token] (S-C-07). Same IP limit as the cancel page (shared key, FR-S-04). */
export async function GET(request: NextRequest, { params }: RouteContext<'/api/ics/[token]'>): Promise<Response> {
  return guardRoute('ics.failed', async () => {
    await connection()
    const { windowSec, limit } = LIMITS.cancelIp
    const rate = await hitWindow(rateKeys.cancelIp(clientIp(request.headers)), windowSec, limit)
    if (!rate.ok) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { ...TOKEN_HEADERS, 'Retry-After': String(rate.retryAfterSec) },
      })
    }

    const { token } = await params
    const booking = await getBookingByToken(token)
    if (!booking) return new Response('Not Found', { status: 404, headers: TOKEN_HEADERS })

    const locale = booking.locale
    const t = await getTranslations({ locale, namespace: 'ics' })
    const cancelUrl = absoluteUrl(`/${locale}/cancel/${token}`)
    const ics = buildIcs({
      uid: `booking-${booking.id}@${new URL(siteUrl()).host}`,
      start: new Date(booking.start),
      end: new Date(booking.end),
      summary: t('summary', { menu: booking.menuName[locale], shop: shop.name }),
      location: `${shop.name}, ${shop.address[locale]}`,
      description: t('description', { code: booking.publicCode, url: cancelUrl }),
      url: cancelUrl,
      alarmText: t('alarm'),
    })
    return new Response(ics, {
      headers: {
        ...TOKEN_HEADERS,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="booking-${booking.publicCode}.ics"`,
      },
    })
  })
}
