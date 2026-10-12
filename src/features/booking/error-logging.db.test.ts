import { randomUUID } from 'node:crypto'
import { inspect } from 'node:util'
import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { pgErrorOf } from '@/lib/pg-errors'
import { jst, resetDb } from '../../../test/db-helpers'
import { captureLogs, withFailingTrigger } from '../../../test/log-capture'
import { cancelByToken, submitBooking } from './service'

/*
 * CR-01 (AGENTS.md rule 6): an unexpected database error must not put PII into the logs.
 * Drizzle's DrizzleQueryError message embeds every SQL parameter, so each case below forces a
 * failure while the statement carries the customer's data and inspects every console line.
 */

const NOW = jst('2026-11-03 12:00')
const PII = {
  name: '山田 太郎',
  kana: 'やまだ たろう',
  phone: '090-1234-5678',
  phoneE164: '+819012345678',
  phoneDigits: '9012345678',
  note: '頭皮が弱いです',
  ip: '203.0.113.9',
  userAgent: 'Mozilla/5.0 (PII-Test-Agent)',
}

const body = () => ({
  locale: 'ja',
  menuSlug: 'cut',
  startsAt: '2026-11-04T19:00:00+09:00',
  name: PII.name,
  nameKana: PII.kana,
  occupation: 'worker',
  phone: PII.phone,
  note: PII.note,
  consent: 'on',
  turnstileToken: 't',
  website: '',
  submissionNonce: randomUUID(),
})
const ctx = { ip: PII.ip, userAgent: PII.userAgent, now: NOW }

function expectNoPii(lines: string[], extra: string[] = []) {
  const text = lines.join('\n')
  for (const value of [...Object.values(PII), ...extra]) expect(text).not.toContain(value)
}

beforeEach(resetDb)

describe('CR-01: no PII in error logs', () => {
  for (const table of ['customers', 'bookings', 'consents'] as const) {
    it(`submitBooking: a failing ${table} INSERT logs only digest / SQLSTATE / constraint`, async () => {
      const { value, lines } = await captureLogs(() =>
        withFailingTrigger(table, 'BEFORE INSERT', () => submitBooking(body(), ctx)),
      )
      expect(value.result).toMatchObject({ status: 'error', digest: expect.stringMatching(/^[0-9a-f]{8}$/) })
      const line = lines.find((l) => l.includes('booking.create_failed'))
      expect(line).toBeDefined()
      expect(JSON.parse(line ?? '{}')).toMatchObject({
        level: 'error',
        errorName: 'DbQueryError',
        errorCode: 'db_P0001',
        sqlstate: 'P0001',
      })
      expectNoPii(lines)
    })
  }

  it('cancelByToken: a failing UPDATE does not log the token', async () => {
    const { result } = await submitBooking(body(), ctx)
    if (result.status !== 'ok') throw new Error(result.status)
    const token = result.data.doneUrl.split('/').at(-1) ?? ''
    const { value, lines } = await captureLogs(() =>
      withFailingTrigger('bookings', 'BEFORE UPDATE', () =>
        cancelByToken({ locale: 'ja', token }, { ip: PII.ip, now: NOW }),
      ),
    )
    expect(value.result.status).toBe('error')
    expect(lines.some((l) => l.includes('booking.cancel_failed'))).toBe(true)
    expectNoPii(lines, [token])
  })

  it('the driver error itself carries no parameters (what Next.js would print for an uncaught error)', async () => {
    let caught: unknown = null
    try {
      await db.execute(sql`SELECT ${PII.phone}::int, ${PII.name}::text, ${PII.ip}::inet`)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    const printed = `${String(caught)}\n${inspect(caught, { depth: 10, showHidden: true })}`
    for (const value of [PII.phone, PII.name, PII.ip]) expect(printed).not.toContain(value)
    // ...while the app can still branch on SQLSTATE (invalid_text_representation).
    expect(pgErrorOf(caught)?.code).toBe('22P02')
  })
})
