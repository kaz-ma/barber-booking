import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { insertNamedBooking, jst, resetDb, seedAdminSession } from '../../test/db-helpers'

/* Push sending (FR-S-03, ADR-0007) with web-push mocked: no network, real Postgres. */

const sendNotification = vi.hoisted(() => vi.fn())
vi.mock('web-push', () => ({ default: { sendNotification } }))

const { sendPushToAll } = await import('./push')
const { notifyOwner } = await import('./notify')
const { bookingTopic, buildDeclarativePayload } = await import('./push-payload')

Object.assign(env as Record<string, unknown>, {
  VAPID_PUBLIC_KEY: 'BPublicKeyForTests',
  VAPID_PRIVATE_KEY: 'privateKeyForTests',
  VAPID_SUBJECT: 'mailto:owner@example.com',
})

class FakeWebPushError extends Error {
  constructor(readonly statusCode: number) {
    super('Received unexpected response code')
    this.name = 'WebPushError'
  }
}

async function addSubscription(userId: string, endpoint: string) {
  await db.execute(sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, platform)
    VALUES (${userId}, ${endpoint}, ${'p'.repeat(87)}, ${'a'.repeat(22)}, 'ios')`)
}

beforeEach(async () => {
  await resetDb()
  sendNotification.mockReset()
})

describe('sendPushToAll', () => {
  it('deletes 404/410 subscriptions, counts failures and logs one row per attempt', async () => {
    const { userId } = await seedAdminSession()
    await addSubscription(userId, 'https://push.example/ok')
    await addSubscription(userId, 'https://push.example/gone')
    await addSubscription(userId, 'https://push.example/busy')
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith('/gone')) throw new FakeWebPushError(410)
      if (sub.endpoint.endsWith('/busy')) throw new FakeWebPushError(429)
      return { statusCode: 201, body: '', headers: {} }
    })

    const payload = buildDeclarativePayload({
      title: 'テスト',
      body: 'body',
      navigate: 'http://localhost:3000/admin',
      tag: 't',
      data: { kind: 'test' },
      badge: 0,
    })
    const results = await sendPushToAll(payload, {
      template: 'test',
      scheduledFor: new Date(),
      urgency: 'high',
      topic: 'test',
    })
    expect(results.map((r) => r.status).sort()).toEqual(['expired', 'failed', 'sent'])

    const opts = sendNotification.mock.calls[0]?.[2]
    expect(opts).toMatchObject({ TTL: 21600, urgency: 'high', topic: 'test', timeout: 8000 })
    expect(opts.vapidDetails).toMatchObject({ subject: 'mailto:owner@example.com' })

    const subs = await db.execute<{ endpoint: string; fail_count: number; ok: boolean }>(sql`
      SELECT endpoint, fail_count, last_success_at IS NOT NULL AS ok FROM push_subscriptions ORDER BY endpoint`)
    expect(subs.rows).toEqual([
      { endpoint: 'https://push.example/busy', fail_count: 1, ok: false },
      { endpoint: 'https://push.example/ok', fail_count: 0, ok: true },
    ])
    const logs = await db.execute<{
      status: string
      http_status: number | null
      error: string | null
      sub: boolean
    }>(sql`
      SELECT status, http_status, error, subscription_id IS NOT NULL AS sub FROM notification_log ORDER BY http_status`)
    expect(logs.rows).toEqual([
      { status: 'sent', http_status: 201, error: null, sub: true },
      { status: 'expired', http_status: 410, error: 'WebPushError 410', sub: false },
      { status: 'failed', http_status: 429, error: 'WebPushError 429', sub: true },
    ])
    expect(JSON.stringify(logs.rows)).not.toContain('push.example')
  })
})

describe('notifyOwner', () => {
  it('sends the declarative payload with no name or phone, badge = unread count', async () => {
    const { userId } = await seedAdminSession()
    await addSubscription(userId, 'https://push.example/ok')
    sendNotification.mockResolvedValue({ statusCode: 201, body: '', headers: {} })
    const { bookingId } = await insertNamedBooking(jst('2026-11-04 18:00'), jst('2026-11-04 19:00'), {
      name: '山田 太郎',
      phone: '+819012345678',
      source: 'web',
      acknowledged: false,
    })

    await notifyOwner('booking_created', bookingId)

    expect(sendNotification).toHaveBeenCalledTimes(1)
    const [, body, opts] = sendNotification.mock.calls[0] ?? []
    const payload = JSON.parse(String(body))
    expect(payload).toMatchObject({
      web_push: 8030,
      mutable: false,
      app_badge: 1,
      notification: {
        title: '新規予約 11/4(水) 18:00 カット',
        lang: 'ja',
        navigate: `http://localhost:3000/admin/bookings/${bookingId}`,
        tag: `booking-${bookingId}`,
        data: { bookingId, kind: 'created' },
        app_badge: 1,
      },
    })
    expect(String(body)).not.toMatch(/山田|太郎|9012345678|090/)
    expect(opts).toMatchObject({ urgency: 'high', topic: bookingTopic(bookingId) })
    expect(bookingTopic(bookingId)).toMatch(/^b[A-Za-z0-9_-]{22}$/)

    const log = await db.execute<{ template: string; booking_id: string }>(
      sql`SELECT template, booking_id FROM notification_log`,
    )
    expect(log.rows).toEqual([{ template: 'booking_created', booking_id: bookingId }])
  })

  it('never throws when nothing is subscribed', async () => {
    const { bookingId } = await insertNamedBooking(jst('2026-11-04 18:00'), jst('2026-11-04 19:00'))
    await expect(notifyOwner('booking_cancelled', bookingId)).resolves.toBeUndefined()
    expect(sendNotification).not.toHaveBeenCalled()
  })
})
