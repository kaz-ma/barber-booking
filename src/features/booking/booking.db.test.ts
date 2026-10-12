import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, pool } from '@/lib/db'
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

  it('same person + slot from another browser (different nonce) -> same answer as a taken slot (SR-12)', async () => {
    await submitBooking(payload(), ctx())
    const same = await submitBooking(payload(), ctx())
    const other = await submitBooking(payload({ phone: '090-3333-4444' }), ctx())
    // Indistinguishable: the response must not reveal that this phone holds the slot.
    expect(same.result).toEqual({ status: 'conflict', reason: 'slot_taken' })
    expect(other.result).toEqual(same.result)
    expect(await count('bookings')).toBe(1)
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
      ctx({ ip: '192.0.2.1', now: jst('2026-11-03 19:00') }),
    )
    expect(late.result).toEqual(notBookable)
    expect(await count('bookings')).toBe(0)
  })

  it('honeypot: pretends success with a real-looking done URL and stores nothing (SR-24)', async () => {
    const { result } = await submitBooking(payload({ website: 'http://spam.example' }), ctx())
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.data.doneUrl).toMatch(/^\/ja\/book\/done\/[A-Za-z0-9_-]{43}$/)
    expect(await getBookingByToken(tokenOf(result.data.doneUrl), NOW)).toBeNull()
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
      { ip: '192.0.2.1', now: jst('2026-11-04 16:59') },
    )
    expect(result).toEqual({ status: 'ok', data: { alreadyCancelled: false } })
    expect(cancelledBookingId).toBeDefined()

    const res = await db.execute<Record<string, unknown>>(
      sql`SELECT status, cancelled_at, acknowledged_at FROM bookings`,
    )
    expect(res.rows[0]).toMatchObject({ status: 'cancelled_by_customer', acknowledged_at: null })
    expect(res.rows[0]?.cancelled_at).not.toBeNull()
    // The link can do nothing more: the token pages no longer resolve it, and a repeated
    // submit is answered "already cancelled" without a second cancellation / push (CR-09).
    expect(await getBookingByToken(token, jst('2026-11-04 16:59'))).toBeNull()
    const again = await cancelByToken({ locale: 'ja', token }, { ip: '192.0.2.1', now: jst('2026-11-04 16:59') })
    expect(again).toEqual({ result: { status: 'ok', data: { alreadyCancelled: true } } })
    // the slot can be booked again (EXCLUDE ignores cancelled rows; partial idempotency index too)
    expect((await submitBooking(payload(), ctx())).result.status).toBe('ok')
  })

  it('after the deadline (start - 120 min): refused with past_deadline', async () => {
    const token = await book()
    const { result } = await cancelByToken({ locale: 'ja', token }, { ip: '192.0.2.1', now: jst('2026-11-04 17:00') })
    expect(result).toEqual({ status: 'past_deadline' })
    const dto = await getBookingByToken(token, jst('2026-11-04 17:00'))
    expect(dto?.canCancel).toBe(false)
  })

  it('invalid tokens are refused without revealing why', async () => {
    await book()
    for (const token of ['short', 'A'.repeat(43), `${'A'.repeat(42)}!`]) {
      expect((await cancelByToken({ locale: 'ja', token }, { ip: '192.0.2.1', now: NOW })).result).toEqual({
        status: 'not_found',
      })
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

describe('review v1 regressions (booking)', () => {
  it('SR-02 / CR-08: concurrent bookings with one phone -> exactly 3 succeed', async () => {
    const days = ['04', '05', '06', '07', '08', '10']
    const results = await Promise.all(
      days.map((d) => submitBooking(payload({ startsAt: `2026-11-${d}T18:00:00+09:00` }), ctx())),
    )
    const statuses = results.map((r) => r.result.status).sort()
    expect(statuses).toEqual(['ok', 'ok', 'ok', 'rate_limited', 'rate_limited', 'rate_limited'])
    expect(await count('bookings')).toBe(3)
  })

  it('CR-02: allow_same_day=false makes today not bookable; true keeps it bookable', async () => {
    await db.execute(sql`UPDATE settings SET allow_same_day = false`)
    const sameDay = await submitBooking(payload({ startsAt: '2026-11-03T19:00:00+09:00' }), ctx())
    expect(sameDay.result).toEqual({ status: 'invalid', fieldErrors: {}, reason: 'not_bookable' })
    // tomorrow is unaffected
    expect((await submitBooking(payload({ startsAt: '2026-11-04T19:00:00+09:00' }), ctx())).result.status).toBe('ok')

    await db.execute(sql`UPDATE settings SET allow_same_day = true`)
    const allowed = await submitBooking(
      payload({ startsAt: '2026-11-03T19:00:00+09:00', phone: '090-7777-0000' }),
      ctx(),
    )
    expect(allowed.result.status).toBe('ok')
  })

  it('CR-05: an /en booking with the same phone keeps the stored furigana', async () => {
    expect((await submitBooking(payload(), ctx())).result.status).toBe('ok')
    const en = await submitBooking(
      payload({ locale: 'en', nameKana: '', name: 'Taro Yamada', startsAt: '2026-11-05T19:00:00+09:00' }),
      ctx(),
    )
    expect(en.result.status).toBe('ok')
    const rows = await db.execute<{ name: string; name_kana: string | null }>(
      sql`SELECT name, name_kana FROM customers`,
    )
    expect(rows.rows).toEqual([{ name: 'Taro Yamada', name_kana: 'やまだ たろう' }])
  })

  it('SR-14: overwriting a customer name is audited with field names only', async () => {
    await submitBooking(payload(), ctx())
    await submitBooking(
      payload({ name: '山田 花子', nameKana: 'やまだ はなこ', startsAt: '2026-11-05T19:00:00+09:00' }),
      ctx(),
    )
    const rows = await db.execute<{ diff: Record<string, unknown> }>(
      sql`SELECT diff FROM audit_log WHERE action = 'customer.overwrite'`,
    )
    expect(rows.rows).toEqual([{ diff: { fields: 'name,nameKana', source: 'web' } }])
    const all = JSON.stringify((await db.execute(sql`SELECT diff FROM audit_log`)).rows)
    for (const value of ['山田', 'やまだ', '090', '+81']) expect(all).not.toContain(value)
    // Same values again: nothing to audit.
    await submitBooking(
      payload({ name: '山田 花子', nameKana: 'やまだ はなこ', startsAt: '2026-11-06T19:00:00+09:00' }),
      ctx(),
    )
    const n = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM audit_log WHERE action = 'customer.overwrite'`,
    )
    expect(n.rows[0]?.n).toBe(1)
  })

  it('CR-06: a student booking a menu without a student price is stored as regular price, no student flag', async () => {
    await db.execute(sql`UPDATE menus SET price_student_jpy = NULL WHERE slug = 'cut'`)
    const { result } = await submitBooking(payload({ occupation: 'student' }), ctx())
    expect(result.status).toBe('ok')
    const rows = await db.execute<{ price_jpy: number; is_student: boolean }>(
      sql`SELECT price_jpy, is_student FROM bookings`,
    )
    expect(rows.rows).toEqual([{ price_jpy: 5000, is_student: false }])
    if (result.status !== 'ok') return
    expect(await getBookingByToken(tokenOf(result.data.doneUrl), NOW)).toMatchObject({
      isStudent: false,
      priceJpy: 5000,
    })
  })

  it('SR-15: consents store an HMAC of the IP, never the raw address', async () => {
    await submitBooking(payload(), ctx({ ip: '203.0.113.42' }))
    const rows = await db.execute<{ ip_hash: string }>(sql`SELECT ip_hash FROM consents`)
    expect(rows.rows).toHaveLength(2)
    for (const r of rows.rows) {
      expect(r.ip_hash).toMatch(/^[A-Za-z0-9_-]{22}$/)
      expect(r.ip_hash).not.toContain('203.0.113')
    }
  })
})

describe('review v1 regressions (cancel)', () => {
  async function book(startsAt = '2026-11-04T19:00:00+09:00') {
    const { result } = await submitBooking(payload({ startsAt }), ctx())
    if (result.status !== 'ok') throw new Error(`booking failed: ${result.status}`)
    return tokenOf(result.data.doneUrl)
  }

  it('SR-01: the 11th cancel attempt from one IP within a minute is rate limited (in the service)', async () => {
    const statuses: string[] = []
    for (let i = 0; i < 11; i++) {
      const { result } = await cancelByToken({ locale: 'ja', token: 'B'.repeat(43) }, { ip: '203.0.113.99', now: NOW })
      statuses.push(result.status)
    }
    expect(statuses.slice(0, 10).every((s) => s === 'not_found')).toBe(true)
    expect(statuses[10]).toBe('rate_limited')
    // another IP is unaffected
    const other = await cancelByToken({ locale: 'ja', token: 'B'.repeat(43) }, { ip: '203.0.113.100', now: NOW })
    expect(other.result.status).toBe('not_found')
  })

  it('SR-01: an unknown token never waits for the calendar lock; a real one does', async () => {
    const token = await book()
    const holder = await pool.connect()
    try {
      // Another writer holds the calendar lock (same key as lockCalendar()).
      await holder.query(`SELECT pg_advisory_lock(hashtext('calendar'), 1)`)
      const unknown = cancelByToken({ locale: 'ja', token: 'Z'.repeat(43) }, { ip: '192.0.2.10', now: NOW })
      const quick = await Promise.race([unknown, sleep(2_000).then(() => 'blocked' as const)])
      expect(quick).toEqual({ result: { status: 'not_found' } })

      let settled = false
      const real = cancelByToken({ locale: 'ja', token }, { ip: '192.0.2.11', now: NOW }).then((r) => {
        settled = true
        return r
      })
      await sleep(300)
      expect(settled).toBe(false) // queued behind the lock
      await holder.query(`SELECT pg_advisory_unlock(hashtext('calendar'), 1)`)
      expect((await real).result).toEqual({ status: 'ok', data: { alreadyCancelled: false } })
    } finally {
      await holder.query('SELECT pg_advisory_unlock_all()')
      holder.release()
    }
  })

  it('CR-09: a double tap cancels once and both taps see success', async () => {
    const token = await book()
    const [a, b] = await Promise.all([
      cancelByToken({ locale: 'ja', token }, { ip: '192.0.2.20', now: NOW }),
      cancelByToken({ locale: 'ja', token }, { ip: '192.0.2.20', now: NOW }),
    ])
    expect([a.result.status, b.result.status]).toEqual(['ok', 'ok'])
    expect([a.cancelledBookingId, b.cancelledBookingId].filter(Boolean)).toHaveLength(1)
    const audits = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM audit_log WHERE action = 'booking.cancel'`,
    )
    expect(audits.rows[0]?.n).toBe(1)
  })
})
