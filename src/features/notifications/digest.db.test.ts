import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { insertNamedBooking, jst, resetDb, seedAdminSession } from '../../../test/db-helpers'

/* Daily digest cron (FR-A-12, AT-23): bearer auth, one push per JST day, counts only. */

const sendNotification = vi.hoisted(() => vi.fn())
vi.mock('web-push', () => ({ default: { sendNotification } }))

const { GET } = await import('@/app/api/cron/daily-digest/route')
const { runDailyDigest } = await import('./digest')
const { runRetention } = await import('./retention')

Object.assign(env as Record<string, unknown>, {
  CRON_SECRET: 'test-cron-secret-0123456789abcdef0123456789',
  VAPID_PUBLIC_KEY: 'BPublicKeyForTests',
  VAPID_PRIVATE_KEY: 'privateKeyForTests',
  VAPID_SUBJECT: 'mailto:owner@example.com',
})

const request = (auth?: string) =>
  new NextRequest('http://localhost:3000/api/cron/daily-digest', auth ? { headers: { authorization: auth } } : {})

beforeEach(async () => {
  await resetDb()
  sendNotification.mockReset()
  sendNotification.mockResolvedValue({ statusCode: 201, body: '', headers: {} })
  const { userId } = await seedAdminSession()
  await db.execute(sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (${userId}, 'https://push.example/1', ${'p'.repeat(87)}, ${'a'.repeat(22)})`)
})

describe('GET /api/cron/daily-digest', () => {
  it('rejects a missing or wrong bearer token', async () => {
    expect((await GET(request())).status).toBe(401)
    expect((await GET(request('Bearer nope'))).status).toBe(401)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('sends once per JST day (second run is skipped)', async () => {
    const auth = `Bearer ${env.CRON_SECRET}`
    const first = await GET(request(auth))
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ result: 'sent' })
    const second = await GET(request(auth))
    expect(await second.json()).toEqual({ result: 'skipped', count: 0 })
    expect(sendNotification).toHaveBeenCalledTimes(1)
  })
})

describe('runDailyDigest', () => {
  it("counts tomorrow's active bookings with first and last start, no names", async () => {
    const now = jst('2026-11-03 21:20')
    await insertNamedBooking(jst('2026-11-04 18:00'), jst('2026-11-04 19:00'), { name: '山田 太郎' })
    await insertNamedBooking(jst('2026-11-04 21:00'), jst('2026-11-04 22:00'))
    await insertNamedBooking(jst('2026-11-04 22:00'), jst('2026-11-04 23:00'), { status: 'cancelled_by_owner' })
    await insertNamedBooking(jst('2026-11-05 18:00'), jst('2026-11-05 19:00'))

    expect(await runDailyDigest(now)).toEqual({ result: 'sent', count: 2 })
    const payload = JSON.parse(String(sendNotification.mock.calls[0]?.[1]))
    expect(payload.notification).toMatchObject({
      title: '明日 11/4(水) の予約 2 件',
      body: '18:00〜21:00 開始',
      navigate: 'http://localhost:3000/admin?date=2026-11-04',
    })
    expect(JSON.stringify(payload)).not.toContain('山田')
    expect(sendNotification.mock.calls[0]?.[2]).toMatchObject({ urgency: 'normal', topic: 'd20261104' })
    const row = await db.execute<{ target_date: string; booking_count: number }>(
      sql`SELECT target_date::text, booking_count FROM daily_digests`,
    )
    expect(row.rows).toEqual([{ target_date: '2026-11-04', booking_count: 2 }])
    expect(await runDailyDigest(jst('2026-11-03 21:50'))).toEqual({ result: 'skipped', count: 0 })
  })

  it('still sends on a zero-booking day and says when tomorrow is a regular holiday', async () => {
    // 2026-11-08 is a Sunday -> tomorrow (Monday) is closed in the seed hours.
    await runDailyDigest(jst('2026-11-08 21:05'))
    const payload = JSON.parse(String(sendNotification.mock.calls[0]?.[1]))
    expect(payload.notification.title).toBe('明日 11/9(月) の予約 0 件')
    expect(payload.notification.body).toBe('明日は定休日です（予約 0 件）')
  })
})

describe('runDailyDigest closures (CR-16)', () => {
  it('says "臨時休業日" when tomorrow is closed by an override, not "定休日"', async () => {
    await db.execute(sql`INSERT INTO business_hour_overrides (date, is_closed) VALUES ('2026-11-05', true)`)
    await runDailyDigest(jst('2026-11-04 21:05'))
    const payload = JSON.parse(String(sendNotification.mock.calls[0]?.[1]))
    expect(payload.notification.body).toBe('明日は臨時休業日です（予約 0 件）')
  })
})

describe('runRetention', () => {
  // Injected clock (AGENTS.md rule 10, CR-07): nothing below depends on the real time.
  const NOW = jst('2026-11-03 03:00')
  const setCreated = (customerId: string, at: string) =>
    db.execute(sql`UPDATE customers SET created_at = ${at}::timestamptz WHERE id = ${customerId}`)

  it('anonymizes customers whose last visit is over 3 years ago and who have no future booking', async () => {
    const old = await insertNamedBooking(jst('2022-01-10 19:00'), jst('2022-01-10 20:00'), {
      status: 'completed',
      phone: '+819000001111',
    })
    const kept = await insertNamedBooking(jst('2022-01-11 19:00'), jst('2022-01-11 20:00'), { status: 'completed' })
    await db.execute(
      sql`UPDATE customers SET last_visit_at = '2022-01-10T11:00:00Z', created_at = '2021-12-01T00:00:00Z'`,
    )
    await insertNamedBooking(jst('2026-12-01 19:00'), jst('2026-12-01 20:00'))
    await db.execute(sql`
      UPDATE bookings SET customer_id = ${kept.customerId} WHERE lower(during) > ${NOW.toISOString()}::timestamptz`)

    expect(await runRetention(NOW)).toEqual({ anonymized: 1 })
    const rows = await db.execute<{ id: string; anon: boolean }>(
      sql`SELECT id, anonymized_at IS NOT NULL AS anon FROM customers WHERE id IN (${old.customerId}, ${kept.customerId})`,
    )
    expect(Object.fromEntries(rows.rows.map((r) => [r.id, r.anon]))).toEqual({
      [old.customerId]: true,
      [kept.customerId]: false,
    })
  })

  it('SR-06 / CR-04: a 5-year-old customer who never visited is anonymized', async () => {
    const customerId = randomUUID()
    await db.execute(sql`
      INSERT INTO customers (id, name, name_kana, phone_e164, phone_display, created_at)
      VALUES (${customerId}, '古い 顧客', 'ふるい こきゃく', '+819000000077', '09000000077',
              ${NOW.toISOString()}::timestamptz - interval '5 years')`)
    expect(await runRetention(NOW)).toEqual({ anonymized: 1 })
    const row = await db.execute<Record<string, unknown>>(
      sql`SELECT name, name_kana, phone_e164, phone_hash IS NOT NULL AS hashed, anonymized_at IS NOT NULL AS anon
          FROM customers WHERE id = ${customerId}`,
    )
    expect(row.rows[0]).toEqual({ name: null, name_kana: null, phone_e164: null, hashed: true, anon: true })
  })

  it('SR-06 / CR-04 / CR-20: cancel-only and never-completed customers are anonymized; free-text cancel reasons cleared', async () => {
    const cancelled = await insertNamedBooking(jst('2022-06-01 19:00'), jst('2022-06-01 20:00'), {
      status: 'cancelled_by_owner',
      phone: '+819011112222',
      source: 'web',
    })
    const unmarked = await insertNamedBooking(jst('2022-07-01 19:00'), jst('2022-07-01 20:00'), {
      phone: '+819033334444',
    })
    await setCreated(cancelled.customerId, '2022-05-01T00:00:00Z')
    await setCreated(unmarked.customerId, '2022-05-01T00:00:00Z')
    await db.execute(sql`
      UPDATE bookings SET cancel_reason = '体調不良（山田さんから電話）', note = '備考', owner_note = 'メモ'
      WHERE id = ${cancelled.bookingId}`)
    await db.execute(sql`UPDATE consents SET ip_hash = 'x', user_agent = 'ua'`)

    expect(await runRetention(NOW)).toEqual({ anonymized: 2 })
    const b = await db.execute<Record<string, unknown>>(
      sql`SELECT cancel_reason, note, owner_note FROM bookings WHERE id = ${cancelled.bookingId}`,
    )
    expect(b.rows[0]).toEqual({ cancel_reason: null, note: null, owner_note: null })
    const c = await db.execute<Record<string, unknown>>(sql`SELECT ip_hash, user_agent FROM consents`)
    expect(c.rows).toEqual([{ ip_hash: null, user_agent: null }])
  })

  it('keeps customers active within 3 years (by booking or creation) and those with a future booking', async () => {
    const recentBooking = await insertNamedBooking(jst('2024-01-10 19:00'), jst('2024-01-10 20:00'), {
      status: 'cancelled_by_customer',
    })
    await setCreated(recentBooking.customerId, '2020-01-01T00:00:00Z')
    const recentCustomer = randomUUID()
    await db.execute(sql`
      INSERT INTO customers (id, name, created_at) VALUES (${recentCustomer}, '新しい 顧客', '2024-06-01T00:00:00Z')`)
    // exactly 3 years ago is not "older than 3 years"
    const boundary = await insertNamedBooking(jst('2023-11-03 02:00'), jst('2023-11-03 03:00'))
    await setCreated(boundary.customerId, '2023-01-01T00:00:00Z')
    expect(await runRetention(NOW)).toEqual({ anonymized: 0 })
  })
})
