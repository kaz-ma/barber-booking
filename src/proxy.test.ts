import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextResponse } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

/* proxy.ts matcher (SR-01, SR-10): dotted paths must not bypass the proxy where it matters. */

vi.mock('next-intl/middleware', () => ({ default: () => () => new NextResponse(null, { status: 200 }) }))
const { config } = await import('./proxy')
const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url })

describe('proxy matcher', () => {
  it('covers dotted paths under /{locale}/cancel and /admin', () => {
    for (const url of [
      '/ja/cancel/x.y',
      '/en/cancel/anything.txt',
      '/ja/book/done/a.b',
      '/admin/bookings/a.b',
      '/admin',
      '/ja',
    ])
      expect(matches(url), url).toBe(true)
  })
  it('still skips static files, the service worker, the manifest and API routes', () => {
    for (const url of [
      '/icons/icon-192.png',
      '/sw.js',
      '/manifest.webmanifest',
      '/api/csp-report',
      '/_next/static/x.js',
    ])
      expect(matches(url), url).toBe(false)
  })
})
