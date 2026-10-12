import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { adminCsp, createNonce } from '@/lib/admin-csp'
import { sessionCookieName } from '@/lib/auth-cookie'
import { clientIp } from '@/lib/client-ip'
import { routing } from '@/lib/i18n/routing'
import { hitWindow, LIMITS, rateKeys } from '@/lib/rate-limit'

/*
 * proxy.ts (Next.js 16, Node runtime; 01_sitemap.md §4.2):
 *   /admin/**             -> bypasses next-intl (ja only). Per-request CSP nonce with
 *                            'strict-dynamic' (08_security.md §8.3) and an optimistic
 *                            session-cookie check -> /admin/login?next= (§4). Server Action
 *                            POSTs are never redirected: requireAdmin() answers `unauthorized`.
 *   /{locale}/cancel/**   -> IP rate limit 10/min on page views (FR-S-04), then next-intl.
 *                            Server Action POSTs are not counted here: cancelByToken() applies
 *                            the same limit itself and answers `rate_limited` (SR-01, CR-21),
 *                            whatever URL the action is posted to.
 *   everything else       -> next-intl locale negotiation (only `/` redirects, 307).
 * This is never the authorization layer; actions and DAL re-check everything.
 */
const intl = createMiddleware(routing)
const CANCEL_PATH = /^\/(ja|en)\/cancel\//

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return adminProxy(request)
  }

  if (CANCEL_PATH.test(pathname) && !isServerAction(request)) {
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

const isServerAction = (request: NextRequest) => request.method === 'POST' && request.headers.has('next-action')

/** Pages reachable without a session (S-A-01 login, S-A-12 install guidance). */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/install'])

function adminProxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl
  const isAction = isServerAction(request)
  if (!PUBLIC_ADMIN_PATHS.has(pathname) && !isAction && !request.cookies.has(sessionCookieName())) {
    const login = new URL('/admin/login', request.url)
    login.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(login, 307)
  }

  const nonce = createNonce()
  const csp = adminCsp(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  // Next.js reads the nonce from the request CSP header and adds it to its own scripts.
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

/*
 * Matcher (SR-01 / SR-10): the first entry skips static files (any path with a dot), so the two
 * prefixes that must never bypass the proxy are listed explicitly — a dotted path such as
 * /ja/cancel/x.y or /admin/bookings/a.b still gets the rate limit / admin CSP and redirect.
 */
export const config = {
  matcher: [
    '/((?!api|_next|_vercel|monitoring|sw\\.js|manifest\\.webmanifest|.*\\..*).*)',
    '/admin',
    '/admin/:path*',
    '/:locale(ja|en)/cancel/:path*',
  ],
}
