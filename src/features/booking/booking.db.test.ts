import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { pgErrorOf } from '@/lib/pg-errors'
import { insertRawBooking, jst, resetDb } from '../../../test/db-helpers'
import { getBookingByToken } from './queries'
import { cancelByToken, submitBooking } from './service'

/* createBooking / cancelBooking pipeline against a real Postgres (FR-S-01, FR-S-04..06). */

const NOW = jst('2026-11-03 12:00')
let ipSeq = 0
const ctx = (overrides: { ip?: string; now?: Date } = {}) => ({
  ip: overrides.ip ?? `198.51.100.${++ipSeq}`,
  userAgent: 'vitest',
  now: overrides.now ?? NOW,
})

function payload(overrides: Record<string, string> = {}) {
  return {
    locale: 'ja',
    menuSlug: 'cut',
    startsAt: '2026-11-04T19:00:00+09:00',
    name: '山田 太郎',
    nameKana: 'やまだ たろう',
    occupation: 'student',
    phone: '090-1234-5678',
    note: '',
    consent: 'on',
    turnstileToken: 'test-token',
    website: '',
    submissionNonce: randomUUID(),
    ...overrides,
  }
}

const tokenOf = (doneUrl: string) => doneUrl.split('/').at(-1) ?? ''

async function count(table: 'bookings' | 'customers' | 'consents' | 'audit_log'): Promise<number> {
  const res = await db.execute<{ n: number }>(sql.raw(`SELECT count(*)::int AS n FROM ${table}`))
  return res.rows[0]?.n ?? 0
}

beforeEach(resetDb)

describe('createBooking', () => {
  it('creates customer, booking, two consents and an audit row; returns only the done URL', async () => {
    const { result, createdBookingId } = await submitBooking(payload(), ctx())
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.data.doneUrl).toMatch(/^\/ja\/book\/done\/[A-Za-z0-9_-]{43}$/)
    expect(createdBookingId).toBeDefined()

    const res = await db.execute<Record<string, unknown>>(sql`
      SELECT b.price_jpy, b.is_student, b.status, b.source, lower(b.during) AS s, upper(b.during) AS e,
             b.cancel_token_expires_at, c.phone_e164, c.name_kana
      FROM bookings b JOIN customers c ON c.id = b.customer_id
    `)
    const row = res.rows[0]
    expect(row).toMatchObject({ price_jpy: 4000, is_student: true, status: 'confirmed', source: 'web' })
    expect(row?.phone_e164).toBe('+819012345678')
    expect(new Date(row?.s as string).toISOString()).toBe(jst('2026-11-04 19:00').toISOString())
    expect(new Date(row?.e as string).toISOString()).toBe(jst('2026-11-04 20:00').toISOString())
    // cancel deadline = start - 120 min
    expect(new Date(row?.cancel_token_expires_at as string).toISOString()).toBe(jst('2026-11-04 17:00').toISOString())
    expect(await count('consents')).toBe(2)
    expect(await count('audit_log')).toBe(1)

    const dto = await getBookingByToken(tokenOf(result.data.doneUrl), NOW)
    expect(dto).toMatchObject({ start: '2026-11-04T19:00:00+09:00', end: '2026-11-04T20:00:00+09:00', canCancel: true })
  })

  it('race: two concurrent submissions for the same slot -> exactly one succeeds, the other SLOT_TAKEN', async () => {
    const [a, b] = await Promise.all([
      submitBooking(payload({ phone: '090-1111-1111' }), ctx()),
      submitBooking(payload({ phone: '090-2222-2222', name: '佐藤 花子', nameKana: 'さとう はなこ' }), ctx()),
    ])
    const statuses = [a.result, b.result].map((r) => (r.status === 'conflict' ? `conflict:${r.reason}` : r.status))
    expect(statuses.sort()).toEqual(['conflict:slot_taken', 'ok'])
    expect(await count('bookings')).toBe(1)
  })

  it('race at the DB level: two concurrent overlapping INSERTs -> one fails with 23P01', async () => {
    const results = await Promise.allSettled([
      insertRawBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00')),
      insertRawBooking(jst('2026-11-04 19:30'), jst('2026-11-04 20:30')),
    ])
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(pgErrorOf((rejected[0] as PromiseRejectedResult).reason)).toMatchObject({
      code: '23P01',
      constraint: 'bookings_no_overlap',
    })
  })

  it('a slot taken earlier is reported as SLOT_TAKEN', async () => {
    await insertRawBooking(jst('2026-11-04 19:30'), jst('2026-11-04 20:30'))
    const { result } = await submitBooking(payload(), ctx())
    expect(result).toEqual({ status: 'conflict', reason: 'slot_taken' })
  })

  it('idempotency: the same payload twice (same nonce) yields one booking and a fresh valid token', async () => {
    const body = payload()
    const first = await submitBooking(body, ctx())
    const second = await submitBooking(body, ctx())
    expect(first.result.status).toBe('ok')
    expect(second.result.status).toBe('ok')
    expect(second.createdBookingId).toBeUndefined()
    expect(await count('bookings')).toBe(1)
    if (first.result.status !== 'ok' || second.result.status !== 'ok') return
    // the token is re-issued: the latest one works, the lost one no longer does
    expect(await getBookingByToken(tokenOf(second.result.data.doneUrl), NOW)).not.toBeNull()
    expect(await getBookingByToken(tokenOf(first.result.data.doneUrl), NOW)).toBeNull()
  })

  it('idempotency: concurrent identical submissions also yield one booking', async () => {
    const body = payload()
    const results = await Promise.all([submitBooking(body, ctx()), submitBooking(body, ctx())])
    expect(results.map((r) => r.result.status)).toEqual(['ok', 'ok'])
    expect(await count('bookings')).toBe(1)
  })

  it('same person + slot from another browser (different nonce) -> duplicate, no details', async () => {
    await submitBooking(payload(), ctx())
    const { result } = await submitBooking(payload(), ctx())
    expect(result).toEqual({ status: 'duplicate' })
  })

  it('re-check rejects times that are not offered: outside hours, lead time, closed day', async () => {
    const notBookable = { status: 'invalid', fieldErrors: {}, reason: 'not_bookable' }
    for (const startsAt of [
      '2026-11-04T23:30:00+09:00', // crosses closing time
      '2026-11-04T19:15:00+09:00', // off the 30-min grid
      '2026-11-09T19:00:00+09:00', // Monday
      '2027-01-03T19:00:00+09:00', // day 61
    ]) {
      expect((await submitBooking(payload({ startsAt }), ctx())).result).toEqual(notBookable)
    }
    const late = await submitBooking(
      payload({ startsAt: '2026-11-03T19:30:00+09:00' }),
      ctx({ now: jst('2026-11-03 19:00') }),
    )
    expect(late.result).toEqual(notBookable)
    expect(await count('bookings')).toBe(0)
  })

  it('honeypot: pretends success and stores nothing', async () => {
    const { result } = await submitBooking(payload({ website: 'http://spam.example' }), ctx())
    expect(result).toEqual({ status: 'ok', data: { doneUrl: '/ja/book' } })
    expect(await count('bookings')).toBe(0)
    expect(await count('customers')).toBe(0)
  })

  it('validation errors are returned as message keys', async () => {
    const { result } = await submitBooking(payload({ phone: '123', nameKana: '' }), ctx())
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(result.fieldErrors.phone).toEqual(['phoneInvalid'])
    expect(result.fieldErrors.nameKana).toEqual(['kanaRequired'])
  })

  it('rate limit: 6th attempt from one IP within 10 minutes is refused', async () => {
    const ip = '203.0.113.7'
    for (let i = 0; i < 5; i++) {
      const { result } = await submitBooking(payload({ phone: '123' }), ctx({ ip })) // invalid, but not counted
      expect(result.status).toBe('invalid')
    }
    // invalid input is rejected before the limiter: count only real attempts
    for (let i = 0; i < 5; i++) {
      const startsAt = `2026-11-${String(4 + i).padStart(2, '0')}T21:00:00+09:00`
      const { result } = await submitBooking(payload({ startsAt, phone: `090-0000-000${i}` }), ctx({ ip }))
      expect(result.status).not.toBe('rate_limited')
    }
    const sixth = await submitBooking(payload({ phone: '090-9999-9999' }), ctx({ ip }))
    expect(sixth.result.status).toBe('rate_limited')
  })

  it('rate limit: 4th booking for the same phone on one JST day is refused', async () => {
    for (const startsAt of ['2026-11-04T18:00:00+09:00', '2026-11-05T18:00:00+09:00', '2026-11-06T18:00:00+09:00']) {
      expect((await submitBooking(payload({ startsAt }), ctx())).result.status).toBe('ok')
    }
    const fourth = await submitBooking(payload({ startsAt: '2026-11-07T18:00:00+09:00' }), ctx())
    expect(fourth.result.status).toBe('rate_limited')
  })

  it('restricted customers are told to use Instagram DM', async () => {
    await submitBooking(payload(), ctx())
    await db.execute(sql`UPDATE customers SET booking_restriction = 'blocked'`)
    const { result } = await submitBooking(payload({ startsAt: '2026-11-05T19:00:00+09:00' }), ctx())
    expect(result).toEqual({ status: 'restricted' })
  })
})

describe('cancelBooking', () => {
  async function book(startsAt = '2026-11-04T19:00:00+09:00') {
    const { result } = await submitBooking(payload({ startsAt }), ctx())
    if (result.status !== 'ok') throw new Error(`booking failed: ${result.status}`)
    return tokenOf(result.data.doneUrl)
  }

  it('before the deadline: cancels, invalidates the token, frees the slot', async () => {
    const token = await book()
    const { result, cancelledBookingId } = await cancelByToken(
      { locale: 'ja', token },
      { now: jst('2026-11-04 16:59') },
    )
    expect(result).toEqual({ status: 'ok', data: null })
    expect(cancelledBookingId).toBeDefined()

    const res = await db.execute<Record<string, unknown>>(
      sql`SELECT status, cancelled_at, cancel_token_hash, acknowledged_at FROM bookings`,
    )
    expect(res.rows[0]).toMatchObject({
      status: 'cancelled_by_customer',
      cancel_token_hash: null,
      acknowledged_at: null,
    })
    expect(res.rows[0]?.cancelled_at).not.toBeNull()
    // single use: the same URL is now "not found"
    expect((await cancelByToken({ locale: 'ja', token }, { now: jst('2026-11-04 16:59') })).result).toEqual({
      status: 'not_found',
    })
    // the slot can be booked again (EXCLUDE ignores cancelled rows; partial idempotency index too)
    expect((await submitBooking(payload(), ctx())).result.status).toBe('ok')
  })

  it('after the deadline (start - 120 min): refused with past_deadline', async () => {
    const token = await book()
    const { result } = await cancelByToken({ locale: 'ja', token }, { now: jst('2026-11-04 17:00') })
    expect(result).toEqual({ status: 'past_deadline' })
    const dto = await getBookingByToken(token, jst('2026-11-04 17:00'))
    expect(dto?.canCancel).toBe(false)
  })

  it('invalid tokens are refused without revealing why', async () => {
    await book()
    for (const token of ['short', 'A'.repeat(43), `${'A'.repeat(42)}!`]) {
      expect((await cancelByToken({ locale: 'ja', token }, { now: NOW })).result).toEqual({ status: 'not_found' })
    }
  })

  it('the raw token is never stored (only its SHA-256)', async () => {
    const token = await book()
    const dump = await db.execute<{ t: string }>(sql`
      SELECT concat_ws(' ',
        (SELECT string_agg(row_to_json(b)::text, ' ') FROM bookings b),
        (SELECT string_agg(row_to_json(a)::text, ' ') FROM audit_log a),
        (SELECT string_agg(row_to_json(c)::text, ' ') FROM consents c)) AS t
    `)
    expect(dump.rows[0]?.t).not.toContain(token)
    const hash = await db.execute<{ ok: boolean }>(
      sql`SELECT cancel_token_hash = sha256(convert_to(${token}, 'UTF8')) AS ok FROM bookings`,
    )
    expect(hash.rows[0]?.ok).toBe(true)
  })

  it('token pages stop showing the booking 24h after it ends', async () => {
    const token = await book()
    expect(await getBookingByToken(token, jst('2026-11-05 19:59'))).not.toBeNull()
    expect(await getBookingByToken(token, jst('2026-11-05 20:00'))).toBeNull()
  })
})
