import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { clientIp } from '@/lib/client-ip'
import { routing } from '@/lib/i18n/routing'
import { hitWindow, LIMITS, rateKeys } from '@/lib/rate-limit'

/*
 * proxy.ts (Next.js 16, Node runtime; 01_sitemap.md §4.2):
 *   /admin/**             -> bypasses next-intl (ja only). TODO(admin slice): optimistic
 *                            session-cookie check + per-request CSP nonce (08_security.md §8.3).
 *   /{locale}/cancel/**   -> IP rate limit 10/min (FR-S-04), then next-intl.
 *   everything else       -> next-intl locale negotiation (only `/` redirects, 307).
 * This is never the authorization layer; actions and DAL re-check everything.
 */
const intl = createMiddleware(routing)
const CANCEL_PATH = /^\/(ja|en)\/cancel\//

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return NextResponse.next()
  }

  if (CANCEL_PATH.test(pathname)) {
    const { windowSec, limit } = LIMITS.cancelIp
    const rate = await hitWindow(rateKeys.cancelIp(clientIp(request.headers)), windowSec, limit)
    if (!rate.ok) {
      const ja = pathname.startsWith('/ja/')
      const body = ja
        ? '<!doctype html><html lang="ja"><meta charset="utf-8"><title>429</title><p>短時間に操作が集中しました。しばらくしてからお試しください。</p></html>'
        : '<!doctype html><html lang="en"><meta charset="utf-8"><title>429</title><p>Too many attempts. Please try again later.</p></html>'
      return new NextResponse(body, {
        status: 429,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Retry-After': String(rate.retryAfterSec),
          'Cache-Control': 'no-store',
        },
      })
    }
  }

  return intl(request)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|monitoring|sw\\.js|manifest\\.webmanifest|.*\\..*).*)'],
}
