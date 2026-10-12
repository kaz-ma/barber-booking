import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../test/db-helpers'

// next-intl's middleware is not under test (and its ESM build imports 'next/server' bare).
vi.mock('next-intl/middleware', () => ({ default: () => () => new NextResponse(null, { status: 200 }) }))
const { default: proxy } = await import('./proxy')

/* proxy.ts cancel-page limit (SR-01, CR-21); the matcher is covered in proxy.test.ts. */

beforeEach(resetDb)

describe('cancel page limit', () => {
  const req = (method: 'GET' | 'POST', path: string) =>
    new NextRequest(`http://localhost:3000${path}`, {
      method,
      headers: { 'x-forwarded-for': '198.51.100.9', ...(method === 'POST' ? { 'next-action': 'abc' } : {}) },
    })

  it('page views: the 11th request in a minute gets 429 (also on a dotted path)', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await proxy(req('GET', '/ja/cancel/x.y'))).status)
    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true)
    expect(statuses[10]).toBe(429)
  })

  it('Server Action POSTs are not answered with an HTML 429 (the service returns rate_limited)', async () => {
    for (let i = 0; i < 15; i++) expect((await proxy(req('POST', '/ja/cancel/x.y'))).status).not.toBe(429)
  })

  it('a dotted admin path still gets the redirect to login (and so the admin CSP path)', async () => {
    const res = await proxy(new NextRequest('http://localhost:3000/admin/bookings/a.b'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/admin/login?next=')
  })
})
