import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '../../../../test/db-helpers'
import { captureLogs } from '../../../../test/log-capture'
import { POST } from './route'

/* POST /api/csp-report (SR-11): 204 always, rate-limited per IP, logs without URLs / IPs. */

const TOKEN = 'Q'.repeat(43)
const report = (ip: string) =>
  new NextRequest('http://localhost:3000/api/csp-report', {
    method: 'POST',
    headers: { 'content-type': 'application/csp-report', 'x-forwarded-for': ip },
    body: JSON.stringify({
      'csp-report': {
        'document-uri': `http://localhost:3000/ja/cancel/${TOKEN}`,
        'effective-directive': 'img-src',
        'blocked-uri': 'https://tracker.example/p.gif',
      },
    }),
  })

beforeEach(resetDb)

describe('POST /api/csp-report', () => {
  it('logs a redacted summary and stops logging above the per-IP limit', async () => {
    const { value, lines } = await captureLogs(async () => {
      const statuses: number[] = []
      for (let i = 0; i < 25; i++) statuses.push((await POST(report('203.0.113.50'))).status)
      return statuses
    })
    expect(value.every((s) => s === 204)).toBe(true)
    const violations = lines.filter((l) => l.includes('csp.violation'))
    expect(violations).toHaveLength(20)
    expect(JSON.parse(violations[0] ?? '{}')).toMatchObject({
      directive: 'img-src',
      blocked: 'https://tracker.example',
    })
    const text = lines.join('\n')
    expect(text).not.toContain(TOKEN)
    expect(text).not.toContain('203.0.113.50')
  })

  it('ignores malformed bodies', async () => {
    const req = new NextRequest('http://localhost:3000/api/csp-report', { method: 'POST', body: '{not json' })
    expect((await POST(req)).status).toBe(204)
  })
})
