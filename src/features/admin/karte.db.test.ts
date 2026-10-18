import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { insertNamedBooking, jst, resetDb } from '../../../test/db-helpers'
import {
  addKartePhoto,
  getBookingKarte,
  getCustomerKarte,
  getNextCustomer,
  getRevisitList,
  markReminded,
  PHOTOS_PER_VISIT,
  saveKarteNote,
  setInstagramHandle,
} from './karte'
import { anonymizeCustomer, exportCustomer } from './service'

/* B3 karte, B4 next customer, B6 revisit (2026-10-18) against a real Postgres. */

/** A tiny but well-formed JPEG header (SOF0 640×480) padded to a plausible size. */
function jpeg(): Uint8Array {
  const head = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]
  const sof = [0xff, 0xc0, 0x00, 0x11, 8, 0x01, 0xe0, 0x02, 0x80, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]
  return new Uint8Array([...head, ...sof, ...new Array(200).fill(0), 0xff, 0xd9])
}

const count = async (q: ReturnType<typeof sql>) => (await db.execute<{ n: number }>(q)).rows[0]?.n ?? 0

beforeEach(resetDb)

describe('karte notes and photos', () => {
  it('saves this visit’s note once per booking and shows it as “previous” on the next visit', async () => {
    const first = await insertNamedBooking(jst('2026-10-01 19:00'), jst('2026-10-01 20:00'), { status: 'completed' })
    await saveKarteNote({ bookingId: first.bookingId, body: 'ツーブロック 6mm' })
    await saveKarteNote({ bookingId: first.bookingId, body: 'ツーブロック 6mm、トップ 5cm' })
    expect(await count(sql`SELECT count(*)::int AS n FROM karte_records`)).toBe(1)

    const res = await db.execute<{ id: string }>(sql`
      INSERT INTO bookings (public_code, customer_id, menu_id, during, status, source, price_jpy)
      SELECT 'KRT00002', ${first.customerId}, id, tstzrange('2026-11-05 19:00+09', '2026-11-05 20:00+09', '[)'),
             'confirmed', 'phone', 5000 FROM menus WHERE slug = 'cut' RETURNING id`)
    const second = res.rows[0]?.id ?? ''
    const k = await getBookingKarte(second)
    expect(k?.current).toBeNull()
    expect(k?.previous?.body).toBe('ツーブロック 6mm、トップ 5cm')
    expect(k?.previous?.date).toBe('2026-10-01')
    const audits = await db.execute<{ diff: Record<string, unknown> }>(
      sql`SELECT diff FROM audit_log WHERE action = 'karte.note'`,
    )
    expect(JSON.stringify(audits.rows)).not.toMatch(/ツーブロック/)
  })

  it('needs the agreement for the first photo, records it once, and caps photos per visit', async () => {
    const b = await insertNamedBooking(jst('2026-10-01 19:00'), jst('2026-10-01 20:00'))
    expect((await addKartePhoto({ bookingId: b.bookingId, consent: false, bytes: jpeg() })).status).toBe('invalid')
    expect((await addKartePhoto({ bookingId: b.bookingId, consent: true, bytes: jpeg() })).status).toBe('ok')
    // Recorded once: later photos need no tick.
    expect((await addKartePhoto({ bookingId: b.bookingId, consent: false, bytes: jpeg() })).status).toBe('ok')
    expect(
      await count(
        sql`SELECT count(*)::int AS n FROM consents WHERE kind = 'photo_karte' AND customer_id = ${b.customerId}`,
      ),
    ).toBe(1)
    for (let i = 2; i < PHOTOS_PER_VISIT; i++)
      await addKartePhoto({ bookingId: b.bookingId, consent: false, bytes: jpeg() })
    const over = await addKartePhoto({ bookingId: b.bookingId, consent: false, bytes: jpeg() })
    expect(over).toEqual({ status: 'invalid', fieldErrors: { photo: ['photoTooMany'] } })
    const k = await getBookingKarte(b.bookingId)
    expect(k?.current?.photos).toHaveLength(PHOTOS_PER_VISIT)
    expect(k?.current?.photos[0]).toMatchObject({ width: 640, height: 480 })
  })

  it('rejects data that is not a JPEG', async () => {
    const b = await insertNamedBooking(jst('2026-10-01 19:00'), jst('2026-10-01 20:00'))
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new Array(200).fill(0)])
    expect(await addKartePhoto({ bookingId: b.bookingId, consent: true, bytes: png })).toEqual({
      status: 'invalid',
      fieldErrors: { photo: ['photoInvalid'] },
    })
  })

  it('anonymization deletes the karte and the Instagram username; the export includes the notes', async () => {
    const b = await insertNamedBooking(jst('2026-10-01 19:00'), jst('2026-10-01 20:00'), { status: 'completed' })
    await saveKarteNote({ bookingId: b.bookingId, body: '前髪は眉上' })
    await addKartePhoto({ bookingId: b.bookingId, consent: true, bytes: jpeg() })
    await setInstagramHandle({ customerId: b.customerId, handle: 'sato.ken' })
    const exported = await exportCustomer(b.customerId)
    if (exported.status !== 'ok') throw new Error('expected ok')
    const json = JSON.parse(exported.data.json)
    expect(json.karte).toEqual([expect.objectContaining({ notes: '前髪は眉上', photos: 1 })])
    expect(json.customer.instagram).toBe('sato.ken')

    expect((await anonymizeCustomer({ customerId: b.customerId })).status).toBe('ok')
    expect(await count(sql`SELECT count(*)::int AS n FROM karte_records`)).toBe(0)
    expect(await count(sql`SELECT count(*)::int AS n FROM karte_photos`)).toBe(0)
    expect(await getCustomerKarte(b.customerId)).toEqual([])
  })
})

describe('revisit list (B6)', () => {
  const NOW = jst('2026-11-10 12:00')

  it('lists customers past the interval with nothing booked, until a reminder is marked', async () => {
    const due = await insertNamedBooking(jst('2026-09-20 19:00'), jst('2026-09-20 20:00'), {
      status: 'completed',
      name: '山田 太郎',
    })
    const recent = await insertNamedBooking(jst('2026-11-01 19:00'), jst('2026-11-01 20:00'), {
      status: 'completed',
      name: '鈴木 一郎',
    })
    const booked = await insertNamedBooking(jst('2026-09-20 18:00'), jst('2026-09-20 19:00'), {
      status: 'completed',
      name: '高橋 健',
    })
    await db.execute(sql`UPDATE customers SET last_visit_at = '2026-09-20 20:00+09'
      WHERE id IN (${due.customerId}, ${booked.customerId})`)
    await db.execute(sql`UPDATE customers SET last_visit_at = '2026-11-01 20:00+09' WHERE id = ${recent.customerId}`)
    await db.execute(sql`
      INSERT INTO bookings (public_code, customer_id, menu_id, during, status, source, price_jpy)
      SELECT 'KRT00003', ${booked.customerId}, id, tstzrange('2026-11-20 19:00+09', '2026-11-20 20:00+09', '[)'),
             'confirmed', 'phone', 5000 FROM menus WHERE slug = 'cut'`)

    const list = await getRevisitList({ weeks: 5 }, NOW)
    expect(list.map((r) => r.name)).toEqual(['山田 太郎'])
    expect(list[0]).toMatchObject({ weeks: 7, menuSlug: 'cut' })

    await markReminded({ customerId: due.customerId }, { now: NOW })
    expect(await getRevisitList({ weeks: 5 }, NOW)).toEqual([])
    await markReminded({ customerId: due.customerId, undo: true }, { now: NOW })
    expect(await getRevisitList({ weeks: 5 }, NOW)).toHaveLength(1)
  })
})

describe('next customer (B4)', () => {
  it('is the booking running now, else the next one today, with their latest karte', async () => {
    const past = await insertNamedBooking(jst('2026-10-01 19:00'), jst('2026-10-01 20:00'), { status: 'completed' })
    await saveKarteNote({ bookingId: past.bookingId, body: 'トップ 5cm' })
    await db.execute(sql`
      INSERT INTO bookings (public_code, customer_id, menu_id, during, status, source, price_jpy)
      SELECT 'KRT00004', ${past.customerId}, id, tstzrange('2026-11-05 19:00+09', '2026-11-05 20:00+09', '[)'),
             'confirmed', 'phone', 5000 FROM menus WHERE slug = 'cut'`)
    const before = await getNextCustomer(jst('2026-11-05 12:00'))
    expect(before).toMatchObject({ now: false, start: '2026-11-05T19:00:00+09:00' })
    expect(before?.karte?.body).toBe('トップ 5cm')
    expect((await getNextCustomer(jst('2026-11-05 19:30')))?.now).toBe(true)
    expect(await getNextCustomer(jst('2026-11-05 20:30'))).toBeNull()
    expect(await getNextCustomer(jst('2026-11-04 12:00'))).toBeNull()
  })
})
