import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { queryAvailabilityDays } from '@/lib/db/availability-sql'
import { hashCancelToken } from '@/lib/tokens'
import { insertBlock, insertNamedBooking, jst, resetDb, seedAdminSession } from '../../../test/db-helpers'
import { captureLogs, withFailingTrigger } from '../../../test/log-capture'
import { getBookingDetail, getCustomerDetail, getDayAgenda, getInbox, getInboxCount, getOverlaps } from './queries'
import {
  acknowledgeAll,
  acknowledgeBooking,
  anonymizeCustomer,
  createManualBooking,
  createTimeBlock,
  deleteTimeBlock,
  logoutOtherDevices,
  reissueConfirmationUrl,
  restoreTimeBlock,
  stepBackBookingStatus,
  subscribePush,
  unacknowledge,
  undoBookingChange,
  updateBookingStatus,
} from './service'

/* Admin service against a real Postgres (FR-A-04..06, FR-A-11, FR-A-14, FR-A-16, AT-21). */

const NOW = jst('2026-11-03 12:00')

async function menuId(slug = 'cut'): Promise<string> {
  const res = await db.execute<{ id: string }>(sql`SELECT id FROM menus WHERE slug = ${slug}`)
  return res.rows[0]?.id ?? ''
}

async function one<T extends Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<T> {
  const res = await db.execute<T>(query)
  return res.rows[0] as T
}

function manual(overrides: Record<string, unknown> = {}) {
  return {
    name: '中村 大輔',
    nameKana: 'なかむら だいすけ',
    phone: undefined as string | undefined,
    menuId: '',
    startsAt: '2026-11-04T19:00:00+09:00',
    source: 'phone' as const,
    linkLocale: 'ja' as const,
    ...overrides,
  }
}

beforeEach(resetDb)

describe('createManualBooking', () => {
  it('saves a booking acknowledged by the owner, creates the customer and returns a confirm URL', async () => {
    const result = await createManualBooking(
      manual({ menuId: await menuId(), phone: '+819012345678', ownerNote: 'DM で受付' }),
      { now: NOW },
    )
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.data.confirmUrl).toMatch(/^http:\/\/localhost:3000\/ja\/book\/done\/[A-Za-z0-9_-]{43}$/)
    expect(result.data.warnings).toEqual([])
    const row = await one<{ source: string; ack: boolean; unverified: boolean; owner_note: string }>(sql`
      SELECT b.source, b.acknowledged_at IS NOT NULL AS ack, c.phone_unverified AS unverified, b.owner_note
      FROM bookings b JOIN customers c ON c.id = b.customer_id`)
    expect(row).toEqual({ source: 'phone', ack: true, unverified: true, owner_note: 'DM で受付' })
    const audit = await one<{ actor: string; diff: Record<string, unknown> }>(
      sql`SELECT actor, diff FROM audit_log WHERE action = 'booking.create'`,
    )
    expect(audit.actor).toBe('owner')
    expect(JSON.stringify(audit.diff)).not.toMatch(/中村|9012345678|DM/)
  })

  it('refuses an overlapping booking with the overlap details and saves nothing (no override)', async () => {
    await insertNamedBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'), { name: '佐藤 健' })
    const result = await createManualBooking(
      manual({ menuId: await menuId(), startsAt: '2026-11-04T19:30:00+09:00' }),
      {
        now: NOW,
      },
    )
    expect(result.status).toBe('conflict')
    if (result.status !== 'conflict' || !('overlaps' in result)) throw new Error('expected overlap details')
    expect(result.overlaps).toHaveLength(1)
    expect(result.overlaps[0]).toMatchObject({
      kind: 'booking',
      label: '佐藤 健様',
      start: '2026-11-04T19:00:00+09:00',
      end: '2026-11-04T20:00:00+09:00',
    })
    const n = await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM bookings`)
    expect(n.n).toBe(1)
  })

  it('allows a touching range and warns about blocks and outside hours', async () => {
    await insertNamedBooking(jst('2026-11-04 18:00'), jst('2026-11-04 19:00'))
    await insertBlock(jst('2026-11-04 19:30'), jst('2026-11-04 19:45'))
    const ok = await createManualBooking(manual({ menuId: await menuId() }), { now: NOW })
    expect(ok.status).toBe('ok')
    if (ok.status === 'ok') expect(ok.data.warnings).toEqual(['block_overlap'])

    const late = await createManualBooking(manual({ menuId: await menuId(), startsAt: '2026-11-04T23:30:00+09:00' }), {
      now: NOW,
    })
    expect(late.status).toBe('ok')
    if (late.status === 'ok') expect(late.data.warnings).toContain('outside_hours')
  })

  it('links an existing customer by phone instead of creating a duplicate', async () => {
    const { customerId } = await insertNamedBooking(jst('2026-11-05 18:00'), jst('2026-11-05 19:00'), {
      phone: '+819011112222',
    })
    const result = await createManualBooking(manual({ menuId: await menuId(), phone: '+819011112222' }), { now: NOW })
    expect(result.status).toBe('ok')
    const row = await one<{ customer_id: string }>(
      sql`SELECT customer_id FROM bookings WHERE lower(during) = ${jst('2026-11-04 19:00').toISOString()}::timestamptz`,
    )
    expect(row.customer_id).toBe(customerId)
  })
})

describe('confirmation URL', () => {
  const tokenOf = (url: string) => url.split('/').pop() ?? ''
  const matches = async (raw: string) =>
    (
      await one<{ ok: boolean }>(
        sql`SELECT count(*) = 1 AS ok FROM bookings WHERE cancel_token_hash = ${hashCancelToken(raw)}`,
      )
    ).ok

  it('the URL from saving a manual booking opens it until a new URL is issued, which replaces it', async () => {
    const created = await createManualBooking(manual({ menuId: await menuId() }), { now: NOW })
    if (created.status !== 'ok') throw new Error('expected ok')
    const first = tokenOf(created.data.confirmUrl)
    expect(await matches(first)).toBe(true)

    const again = await reissueConfirmationUrl({ bookingId: created.data.bookingId, linkLocale: 'en' }, { now: NOW })
    if (again.status !== 'ok') throw new Error('expected ok')
    expect(again.data.confirmUrl).toMatch(/^http:\/\/localhost:3000\/en\/book\/done\/[A-Za-z0-9_-]{43}$/)
    expect(await matches(tokenOf(again.data.confirmUrl))).toBe(true)
    expect(await matches(first)).toBe(false)
  })

  it('is not issued for a booking that is no longer confirmed', async () => {
    const created = await createManualBooking(manual({ menuId: await menuId() }), { now: NOW })
    if (created.status !== 'ok') throw new Error('expected ok')
    await db.execute(sql`UPDATE bookings SET status = 'arrived' WHERE id = ${created.data.bookingId}`)
    const res = await reissueConfirmationUrl({ bookingId: created.data.bookingId, linkLocale: 'ja' }, { now: NOW })
    expect(res.status).toBe('invalid')
  })
})

describe('time blocks', () => {
  it('hides the covered slots from the customer availability', async () => {
    const res = await createTimeBlock(
      {
        start: '2026-11-04T20:00:00+09:00',
        end: '2026-11-04T21:00:00+09:00',
        kind: 'break',
        force: false,
      },
      { now: NOW },
    )
    expect(res.status).toBe('ok')
    if (res.status === 'ok') expect(res.data.publicImpactUntil).toBe('2026-11-04T21:00:00+09:00')
    const [day] = await queryAvailabilityDays(db, { menuSlug: 'cut', from: '2026-11-04', to: '2026-11-04', now: NOW })
    const status = (hhmm: string) =>
      day?.slots.find((s) => s.startsAt.getTime() === jst(`2026-11-04 ${hhmm}`).getTime())?.status
    expect(status('19:00')).toBe('available')
    expect(status('19:30')).toBe('full') // 19:30-20:30 overlaps 20:00
    expect(status('20:30')).toBe('full')
    expect(status('21:00')).toBe('available')
  })

  it('reports overlapping bookings and only saves with force (the booking stays)', async () => {
    await insertNamedBooking(jst('2026-11-04 21:00'), jst('2026-11-04 22:00'), { name: '加藤 大翔' })
    const input = { start: '2026-11-04T20:30:00+09:00', end: '2026-11-04T22:30:00+09:00', kind: 'private' as const }
    const refused = await createTimeBlock({ ...input, force: false }, { now: NOW })
    expect(refused.status).toBe('conflict')
    if (refused.status === 'conflict' && 'overlaps' in refused) expect(refused.overlaps[0]?.label).toBe('加藤 大翔様')
    expect((await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM time_blocks`)).n).toBe(0)

    const forced = await createTimeBlock({ ...input, force: true }, { now: NOW })
    expect(forced.status).toBe('ok')
    const active = await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM bookings WHERE status = 'confirmed'`)
    expect(active.n).toBe(1)
  })

  it('computes presets from now (5-minute floor) and closing time; no customer impact inside lead time', async () => {
    const now = jst('2026-11-04 19:12')
    const p60 = await createTimeBlock({ preset: 'now60', kind: 'break', force: false }, { now })
    expect(p60.status).toBe('ok')
    if (p60.status === 'ok') {
      expect(p60.data.start).toBe('2026-11-04T19:10:00+09:00')
      expect(p60.data.end).toBe('2026-11-04T20:10:00+09:00')
      // Ends before now + lead time (20:12): the customer site does not change.
      expect(p60.data.publicImpactUntil).toBeNull()
    }
    const p120 = await createTimeBlock({ preset: 'now120', kind: 'break', force: true }, { now })
    if (p120.status === 'ok') expect(p120.data.publicImpactUntil).toBe('2026-11-04T21:10:00+09:00')
    const close = await createTimeBlock({ preset: 'untilClose', kind: 'closed', force: true }, { now })
    if (close.status !== 'ok') throw new Error(close.status)
    expect(close.data.end).toBe('2026-11-05T00:00:00+09:00')

    const short = await createTimeBlock(
      { start: '2026-11-04T19:15:00+09:00', end: '2026-11-04T19:45:00+09:00', kind: 'break', force: true },
      { now },
    )
    if (short.status === 'ok') expect(short.data.publicImpactUntil).toBeNull()
  })

  it('deletes and restores a block only within the undo window', async () => {
    const res = await createTimeBlock(
      { start: '2026-11-04T20:00:00+09:00', end: '2026-11-04T21:00:00+09:00', kind: 'break', force: false },
      { now: NOW },
    )
    if (res.status !== 'ok') throw new Error(res.status)
    const deletedAt = new Date()
    expect((await deleteTimeBlock(res.data.blockId, { now: deletedAt })).status).toBe('ok')
    expect((await restoreTimeBlock(res.data.blockId, { now: new Date(deletedAt.getTime() + 3000) })).status).toBe('ok')
    await deleteTimeBlock(res.data.blockId, { now: deletedAt })
    const late = await restoreTimeBlock(res.data.blockId, { now: new Date(deletedAt.getTime() + 15_000) })
    expect(late.status).toBe('invalid')
  })
})

describe('updateBookingStatus', () => {
  it('walks confirmed -> arrived -> in_progress -> completed and records the visit', async () => {
    const { bookingId, customerId } = await insertNamedBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'))
    for (const to of ['arrived', 'in_progress', 'completed'] as const) {
      const r = await updateBookingStatus({ bookingId, to }, { now: NOW })
      expect(r.status).toBe('ok')
    }
    const c = await one<{ last_visit_at: string | null }>(
      sql`SELECT last_visit_at FROM customers WHERE id = ${customerId}`,
    )
    expect(new Date(c.last_visit_at ?? 0).toISOString()).toBe(jst('2026-11-04 20:00').toISOString())
    const audits = await one<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM audit_log WHERE action = 'booking.status'`,
    )
    expect(audits.n).toBe(3)
  })

  it('rejects transitions outside the state machine', async () => {
    const { bookingId } = await insertNamedBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'))
    expect((await updateBookingStatus({ bookingId, to: 'completed' }, { now: NOW })).status).toBe('invalid')
    expect((await updateBookingStatus({ bookingId, to: 'cancelled_by_customer' }, { now: NOW })).status).toBe('invalid')
    expect((await updateBookingStatus({ bookingId, to: 'confirmed' }, { now: NOW })).status).toBe('invalid')
    const done = await insertNamedBooking(jst('2026-11-04 21:00'), jst('2026-11-04 22:00'), { status: 'completed' })
    expect((await updateBookingStatus({ bookingId: done.bookingId, to: 'arrived' }, { now: NOW })).status).toBe(
      'invalid',
    )
    expect(
      (await updateBookingStatus({ bookingId: '00000000-0000-4000-8000-000000000000', to: 'arrived' }, { now: NOW }))
        .status,
    ).toBe('not_found')
  })

  it('no_show increments the counter and undo within the window restores it', async () => {
    const { bookingId, customerId } = await insertNamedBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'))
    const r = await updateBookingStatus({ bookingId, to: 'no_show' }, { now: NOW })
    if (r.status !== 'ok' || !r.data.undoToken) throw new Error('expected undo token')
    expect((await one<{ n: number }>(sql`SELECT no_show_count AS n FROM customers WHERE id = ${customerId}`)).n).toBe(1)
    const undo = await undoBookingChange(r.data.undoToken, { now: new Date(NOW.getTime() + 4000) })
    expect(undo.status).toBe('ok')
    const row = await one<{ status: string; n: number }>(sql`
      SELECT b.status, c.no_show_count AS n FROM bookings b JOIN customers c ON c.id = b.customer_id
      WHERE b.id = ${bookingId}`)
    expect(row).toEqual({ status: 'confirmed', n: 0 })
  })

  it('owner cancel frees the slot, keeps the token restorable, and undo is blocked once the slot is taken', async () => {
    const { bookingId } = await insertNamedBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'))
    await db.execute(
      sql`UPDATE bookings SET cancel_token_hash = decode(repeat('ab', 32), 'hex') WHERE id = ${bookingId}`,
    )
    const r = await updateBookingStatus({ bookingId, to: 'cancelled_by_owner' }, { now: NOW })
    if (r.status !== 'ok' || !r.data.undoToken) throw new Error('expected undo token')
    const cancelled = await one<{ hash: string | null; cancelled: boolean }>(sql`
      SELECT encode(cancel_token_hash, 'hex') AS hash, cancelled_at IS NOT NULL AS cancelled FROM bookings WHERE id = ${bookingId}`)
    expect(cancelled).toEqual({ hash: null, cancelled: true })

    // Expired token
    expect((await undoBookingChange(r.data.undoToken, { now: new Date(NOW.getTime() + 11_000) })).status).toBe(
      'invalid',
    )

    // The slot is re-booked meanwhile: undo must not create a double booking (23P01).
    await insertNamedBooking(jst('2026-11-04 19:30'), jst('2026-11-04 20:30'))
    const blocked = await undoBookingChange(r.data.undoToken, { now: new Date(NOW.getTime() + 2000) })
    expect(blocked).toEqual({ status: 'conflict', reason: 'undo_blocked' })
  })

  it('undo of an owner cancel restores the customer link', async () => {
    const { bookingId } = await insertNamedBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'))
    await db.execute(
      sql`UPDATE bookings SET cancel_token_hash = decode(repeat('cd', 32), 'hex') WHERE id = ${bookingId}`,
    )
    const r = await updateBookingStatus({ bookingId, to: 'cancelled_late' }, { now: NOW })
    if (r.status !== 'ok' || !r.data.undoToken) throw new Error('expected undo token')
    expect((await undoBookingChange(r.data.undoToken, { now: NOW })).status).toBe('ok')
    const row = await one<{ hash: string; status: string; late: number }>(sql`
      SELECT encode(b.cancel_token_hash, 'hex') AS hash, b.status, c.late_cancel_count AS late
      FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.id = ${bookingId}`)
    expect(row).toEqual({ hash: 'cd'.repeat(32), status: 'confirmed', late: 0 })
  })
})

describe('inbox / acknowledge', () => {
  it('counts unread web bookings and customer cancellations; acknowledge and undo', async () => {
    const a = await insertNamedBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'), {
      source: 'web',
      acknowledged: false,
    })
    await insertNamedBooking(jst('2026-11-04 21:00'), jst('2026-11-04 22:00'), {
      source: 'web',
      status: 'cancelled_by_customer',
      acknowledged: false,
    })
    // Manual bookings never count as unread.
    await insertNamedBooking(jst('2026-11-04 22:00'), jst('2026-11-04 23:00'), { acknowledged: false })
    expect((await getInboxCount()).unacknowledged).toBe(2)
    const inbox = await getInbox(NOW)
    expect(inbox.unread.map((i) => i.kind).sort()).toEqual(['cancel', 'new'])

    const ack = await acknowledgeBooking(a.bookingId, { now: NOW })
    expect(ack).toEqual({ status: 'ok', data: { unacknowledged: 1 } })
    const all = await acknowledgeAll({ now: NOW })
    if (all.status !== 'ok') throw new Error(all.status)
    expect(all.data.unacknowledged).toBe(0)
    expect(all.data.ids).toHaveLength(1)
    expect((await unacknowledge(all.data.ids)).status).toBe('ok')
    expect((await getInboxCount()).unacknowledged).toBe(1)
  })
})

describe('day agenda / overlaps DAL', () => {
  it('returns timeline items in JST minutes and widens the axis for out-of-hours items', async () => {
    await insertNamedBooking(jst('2026-11-04 17:00'), jst('2026-11-04 18:00'), { name: '早い 客' })
    await insertBlock(jst('2026-11-04 21:00'), jst('2026-11-04 21:30'))
    const agenda = await getDayAgenda('2026-11-04')
    expect(agenda.axis).toEqual({ startMin: 17 * 60, endMin: 24 * 60 })
    expect(agenda.bookings[0]).toMatchObject({ startMin: 17 * 60, endMin: 18 * 60, name: '早い 客' })
    expect(agenda.blocks[0]).toMatchObject({ startMin: 21 * 60, endMin: 21 * 60 + 30, kind: 'break' })
    expect(agenda.freeMinutes).toBe(6 * 60 - 30)
    const ov = await getOverlaps({ start: jst('2026-11-04 17:30'), end: jst('2026-11-04 18:30') })
    expect(ov.outsideHours).toBe(true)
    expect(ov.overlaps).toHaveLength(1)
  })
})

describe('anonymizeCustomer', () => {
  it('removes PII, cancels future bookings, keeps statistics; wrong last 4 digits is refused', async () => {
    const { customerId, bookingId } = await insertNamedBooking(jst('2026-11-10 19:00'), jst('2026-11-10 20:00'), {
      name: '削除 依頼',
      phone: '+819055556666',
    })
    await db.execute(sql`UPDATE bookings SET note = '自由記述', owner_note = 'メモ' WHERE id = ${bookingId}`)
    const past = await insertNamedBooking(jst('2026-10-01 19:00'), jst('2026-10-01 20:00'), { status: 'completed' })
    await db.execute(sql`UPDATE bookings SET customer_id = ${customerId} WHERE id = ${past.bookingId}`)

    expect((await anonymizeCustomer({ customerId, confirmPhoneLast4: '0000' }, { now: NOW })).status).toBe('invalid')
    const res = await anonymizeCustomer({ customerId, confirmPhoneLast4: '6666' }, { now: NOW })
    expect(res).toEqual({ status: 'ok', data: { cancelledBookings: 1 } })

    const c = await one<Record<string, unknown>>(sql`
      SELECT name, name_kana, phone_e164, phone_display, phone_hash IS NOT NULL AS has_hash, anonymized_at IS NOT NULL AS anon
      FROM customers WHERE id = ${customerId}`)
    expect(c).toEqual({
      name: null,
      name_kana: null,
      phone_e164: null,
      phone_display: null,
      has_hash: true,
      anon: true,
    })
    const bookingsLeft = await db.execute<{ status: string; note: string | null; owner_note: string | null }>(sql`
      SELECT status, note, owner_note FROM bookings WHERE customer_id = ${customerId} ORDER BY lower(during)`)
    expect(bookingsLeft.rows).toEqual([
      { status: 'completed', note: null, owner_note: null },
      { status: 'cancelled_by_owner', note: null, owner_note: null },
    ])
    const audit = await one<{ diff: Record<string, unknown> }>(
      sql`SELECT diff FROM audit_log WHERE action = 'customer.anonymize'`,
    )
    expect(JSON.stringify(audit.diff)).not.toMatch(/削除|5555|6666/)
  })
})

describe('push subscriptions / devices', () => {
  it('upserts by endpoint and logoutOtherDevices revokes other sessions and their subscriptions', async () => {
    const me = await seedAdminSession()
    const other = randomSession(me.userId)
    await db.execute(sql`
      INSERT INTO auth_session (id, user_id, token, expires_at)
      VALUES (${other}, ${me.userId}, ${`tok-${other}`}, now() + interval '30 days')`)
    const sub = (endpoint: string) => ({
      subscription: { endpoint, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } },
      platform: 'ios' as const,
    })
    await subscribePush(sub('https://push.example/me'), { ...me, userAgent: 'iPhone' })
    await subscribePush(sub('https://push.example/me'), { ...me, userAgent: 'iPhone' })
    await subscribePush(sub('https://push.example/other'), { userId: me.userId, sessionId: other, userAgent: 'iPad' })
    expect((await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM push_subscriptions`)).n).toBe(2)

    const res = await logoutOtherDevices(me)
    expect(res).toEqual({ status: 'ok', data: { revokedSessions: 1, removedSubscriptions: 1 } })
    const left = await db.execute<{ endpoint: string }>(sql`SELECT endpoint FROM push_subscriptions`)
    expect(left.rows).toEqual([{ endpoint: 'https://push.example/me' }])
    const sessions = await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM auth_session`)
    expect(sessions.n).toBe(1)
  })
})

function randomSession(userId: string): string {
  return `${userId.slice(0, 8)}-other-session`
}

describe('CR-01: admin errors are logged without PII', () => {
  it('createManualBooking: a failing INSERT logs no name / kana / phone / owner note', async () => {
    const input = manual({ menuId: await menuId(), phone: '+819087654321', ownerNote: '常連・右側を短めに' })
    const { value, lines } = await captureLogs(() =>
      withFailingTrigger('bookings', 'BEFORE INSERT', () => createManualBooking(input, { now: NOW })),
    )
    expect(value).toMatchObject({ status: 'error', digest: expect.any(String) })
    const text = lines.join('\n')
    expect(text).toContain('admin.manual_booking_failed')
    for (const pii of ['中村', 'なかむら', '+819087654321', '9087654321', '常連']) expect(text).not.toContain(pii)
  })
})

describe('stepBackBookingStatus (CR-24, 直前状態へ戻す)', () => {
  it('steps completed -> in_progress -> arrived -> confirmed, restoring last_visit_at and late minutes', async () => {
    const earlier = await insertNamedBooking(jst('2026-10-01 19:00'), jst('2026-10-01 20:00'), { status: 'completed' })
    const { bookingId, customerId } = await insertNamedBooking(jst('2026-11-03 11:00'), jst('2026-11-03 12:00'))
    // same customer for both bookings
    await db.execute(sql`UPDATE bookings SET customer_id = ${customerId} WHERE id = ${earlier.bookingId}`)
    await db.execute(
      sql`UPDATE customers SET last_visit_at = ${jst('2026-10-01 20:00').toISOString()}::timestamptz WHERE id = ${customerId}`,
    )

    expect((await updateBookingStatus({ bookingId, to: 'arrived', lateMinutes: 10 }, { now: NOW })).status).toBe('ok')
    expect((await updateBookingStatus({ bookingId, to: 'in_progress' }, { now: NOW })).status).toBe('ok')
    expect((await updateBookingStatus({ bookingId, to: 'completed' }, { now: NOW })).status).toBe('ok')
    const lastVisit = async () =>
      new Date(
        (await one<{ v: string }>(sql`SELECT last_visit_at AS v FROM customers WHERE id = ${customerId}`)).v,
      ).toISOString()
    expect(await lastVisit()).toBe(jst('2026-11-03 12:00').toISOString())

    expect(await stepBackBookingStatus(bookingId, { now: NOW })).toEqual({
      status: 'ok',
      data: { status: 'in_progress' },
    })
    expect(await lastVisit()).toBe(jst('2026-10-01 20:00').toISOString())
    expect(await stepBackBookingStatus(bookingId, { now: NOW })).toEqual({ status: 'ok', data: { status: 'arrived' } })
    expect(await stepBackBookingStatus(bookingId, { now: NOW })).toEqual({
      status: 'ok',
      data: { status: 'confirmed' },
    })
    const row = await one<{ status: string; late_minutes: number | null }>(
      sql`SELECT status, late_minutes FROM bookings WHERE id = ${bookingId}`,
    )
    expect(row).toEqual({ status: 'confirmed', late_minutes: null })
    // nothing before confirmed
    expect((await stepBackBookingStatus(bookingId, { now: NOW })).status).toBe('invalid')
    const audits = await one<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM audit_log WHERE action = 'booking.step_back'`,
    )
    expect(audits.n).toBe(3)
  })

  it('cannot step a completed booking back into a slot that was re-booked meanwhile', async () => {
    const { bookingId } = await insertNamedBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'), {
      status: 'completed',
    })
    await insertNamedBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'))
    expect(await stepBackBookingStatus(bookingId, { now: NOW })).toEqual({ status: 'conflict', reason: 'undo_blocked' })
  })
})

describe('malformed ids (CR-11)', () => {
  it('detail queries return null instead of failing the uuid cast', async () => {
    for (const id of ['-'.repeat(36), 'abc', '6f1c1d2e3a4b4c5d8e9f0a1b2c3d4e5f----']) {
      expect(await getBookingDetail(id)).toBeNull()
      expect(await getCustomerDetail(id)).toBeNull()
    }
  })
})
