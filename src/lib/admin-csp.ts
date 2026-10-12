import { env } from '@/lib/env'

/*
 * Enforcing, nonce-based CSP for /admin/** (08_security.md §8.3). Admin pages are rendered per
 * request (`instant = false` + headers() in the admin root layout), so Next.js can stamp the
 * nonce on its own scripts. 'strict-dynamic' lets those scripts load their chunks.
 * Dev needs 'unsafe-eval' (React debug stacks) — never in production.
 */
export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

export function adminCsp(nonce: string): string {
  const isDev = env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
    // Violations go to the same-origin /api/csp-report (SR-11) unless Sentry is configured;
    // `report-to` uses the Reporting-Endpoints header from next.config.ts.
    `report-uri ${env.SENTRY_CSP_REPORT_URI ?? '/api/csp-report'}`,
    ...(env.SENTRY_CSP_REPORT_URI || env.SITE_URL ? ['report-to csp-endpoint'] : []),
  ].join('; ')
}
