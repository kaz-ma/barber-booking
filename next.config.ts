import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
// Validate the environment at build time so a missing variable fails the build (DES-00 §4).
import { env } from './src/lib/env'

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts')
const isDev = env.NODE_ENV === 'development'

/*
 * CSP for public pages (08_security.md §8.2). Public pages have a static shell, so no nonce:
 * 'unsafe-inline' scripts are accepted and XSS defence relies on React escaping (T-09).
 * Shipped as Report-Only first; switch to enforcing after a clean week on staging (AT-26),
 * and add 'upgrade-insecure-requests' then (browsers ignore it in Report-Only).
 * TODO(admin slice): /admin gets a nonce-based enforcing CSP from proxy.ts (§8.3).
 */
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
  ...(env.SENTRY_CSP_REPORT_URI ? [`report-uri ${env.SENTRY_CSP_REPORT_URI}`] : []),
].join('; ')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy-Report-Only', value: csp },
  ...(env.VERCEL_ENV === 'production' ? [] : [{ key: 'X-Robots-Tag', value: 'noindex' }]),
]

/** Token-bearing pages (T-06, U-06). Later entries override earlier ones for the same key. */
const tokenHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Cache-Control', value: 'private, no-store' },
]

const nextConfig: NextConfig = {
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
      { source: '/:locale(ja|en)/book/:step(time|info|confirm)', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
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

export default withNextIntl(nextConfig)
