import type { NextConfig } from 'next'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import createNextIntlPlugin from 'next-intl/plugin'
import { parseServerEnv } from './src/lib/env-schema'

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts')

/** Same-origin CSP report endpoint (SR-11): counted and logged without URLs or PII. */
const CSP_REPORT_PATH = '/api/csp-report'

/*
 * CSP for public pages (08_security.md §8.2). Public pages have a static shell, so no nonce:
 * 'unsafe-inline' scripts are accepted and XSS defence relies on React escaping (T-09).
 * Shipped as Report-Only first; switch to enforcing after a clean week on staging (AT-26),
 * and add 'upgrade-insecure-requests' then (browsers ignore it in Report-Only).
 * /admin/** gets a nonce-based enforcing CSP from proxy.ts instead (§8.3, src/lib/admin-csp.ts),
 * so the public Report-Only policy is not sent there.
 */
function buildConfig(env: Env): NextConfig {
  const isDev = env.NODE_ENV === 'development'
  const reportUri = env.SENTRY_CSP_REPORT_URI ?? CSP_REPORT_PATH
  const reportEndpoint = env.SENTRY_CSP_REPORT_URI ?? (env.SITE_URL ? `${env.SITE_URL}${CSP_REPORT_PATH}` : null)
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    `report-uri ${reportUri}`,
    ...(reportEndpoint ? ['report-to csp-endpoint'] : []),
  ].join('; ')
  // CSP_ENFORCE=1 switches to enforcing after a clean Report-Only week (AT-26), no code change.
  const cspHeader = env.CSP_ENFORCE === '1' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'

  const securityHeaders = [
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ...(env.VERCEL_ENV === 'production' ? [] : [{ key: 'X-Robots-Tag', value: 'noindex' }]),
    ...(reportEndpoint ? [{ key: 'Reporting-Endpoints', value: `csp-endpoint="${reportEndpoint}"` }] : []),
  ]

  /** Token-bearing pages (T-06, U-06). Later entries override earlier ones for the same key. */
  const tokenHeaders = [
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    { key: 'Cache-Control', value: 'private, no-store' },
  ]

  return {
    cacheComponents: true,
    partialPrefetching: true,
    typedRoutes: true,
    poweredByHeader: false,
    experimental: {
      // Multiple root layouts ((public)/[locale] and (admin)/admin) need a global 404.
      globalNotFound: true,
    },
    async headers() {
      return [
        { source: '/:path*', headers: securityHeaders },
        // Public CSP (Report-Only) everywhere except /admin/** (nonce CSP from proxy.ts).
        { source: '/((?!admin(?:/|$)).*)', headers: [{ key: cspHeader, value: csp }] },
        // Service worker (05 §7.2, 08 §8.4): always revalidated, own minimal CSP.
        {
          source: '/sw.js',
          headers: [
            { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
            { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
            { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
          ],
        },
        {
          source: '/manifest.webmanifest',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
        },
        {
          source: '/:locale(ja|en)/book/:step(time|info|confirm)',
          headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
        },
        { source: '/:locale(ja|en)/book/done/:token', headers: tokenHeaders },
        { source: '/:locale(ja|en)/cancel/:token', headers: tokenHeaders },
        { source: '/api/ics/:token', headers: tokenHeaders },
        { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
        {
          source: '/admin/:path*',
          headers: [
            { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
            { key: 'Cache-Control', value: 'private, no-store' },
          ],
        },
        {
          source: '/admin',
          headers: [
            { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
            { key: 'Cache-Control', value: 'private, no-store' },
          ],
        },
      ]
    },
  }
}

type Env = ReturnType<typeof parseServerEnv>

/*
 * The environment is validated when the config loads (DES-00 §4), with the phase Next passes in:
 * `next build` runs without secrets (CI), `next start` / `next dev` validate fully (SR-05).
 * NEXT_PHASE is exported early so src/lib/env.ts in this build process agrees.
 */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) process.env.NEXT_PHASE = PHASE_PRODUCTION_BUILD
  return withNextIntl(buildConfig(parseServerEnv(process.env)))
}
