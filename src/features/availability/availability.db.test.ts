import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { addMenu, insertBlock, insertRawBooking, jst, resetDb } from '../../../test/db-helpers'
import { getDayAvailability, getMonthAvailability } from './queries'

/*
 * Contract tests for the availability SQL (04_data_model.md §6 table, FR-S-02).
 * "Today" is Tue 2026-11-03 JST; business hours Sun, Tue-Sat 18:00-24:00, Mon closed,
 * 30-min step, 60-min lead time, 60 days max advance.
 */
const NOON = jst('2026-11-03 12:00')
const startsOf = (day: Awaited<ReturnType<typeof getDayAvailability>>, status?: string) =>
  (day?.slots ?? []).filter((s) => !status || s.status === status).map((s) => s.startsAt.slice(11, 16))

beforeEach(resetDb)

describe('getDayAvailability', () => {
  it('60-min menu: 18:00 … 23:00 (11 slots); 23:30 would cross closing and is not offered', async () => {
    const day = await getDayAvailability({ menuSlug: 'cut', date: '2026-11-04' }, NOON)
    expect(day?.status).toBe('available')
    expect(startsOf(day)).toEqual([
      '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00',
    ])
    expect(startsOf(day, 'available')).toHaveLength(11)
    expect(day?.slots[0]?.startsAt).toBe('2026-11-04T18:00:00+09:00')
  })

  it('90-min menu: last start is 22:30', async () => {
    await addMenu('long', 90)
    const day = await getDayAvailability({ menuSlug: 'long', date: '2026-11-04' }, NOON)
    expect(startsOf(day).at(-1)).toBe('22:30')
  })

  it('Monday is closed (regular)', async () => {
    const day = await getDayAvailability({ menuSlug: 'cut', date: '2026-11-09' }, NOON)
    expect(day).toMatchObject({ status: 'closed', closedReason: 'regular', slots: [] })
  })

  it('closed override wins over the weekly template', async () => {
    await db.execute(sql`INSERT INTO business_hour_overrides (date, is_closed) VALUES ('2026-11-04', true)`)
    const day = await getDayAvailability({ menuSlug: 'cut', date: '2026-11-04' }, NOON)
    expect(day).toMatchObject({ status: 'closed', closedReason: 'override', slots: [] })
  })

  it('lead time: at 19:01 slots up to 20:00 are deadline, 20:30 onward available', async () => {
    const day = await getDayAvailability({ menuSlug: 'cut', date: '2026-11-03' }, jst('2026-11-03 19:01'))
    expect(startsOf(day, 'deadline')).toEqual(['18:00', '18:30', '19:00', '19:30', '20:00'])
    expect(startsOf(day, 'available')[0]).toBe('20:30')
    // now + 59 min must never be bookable
    expect(startsOf(day, 'available')).not.toContain('20:00')
  })

  it('max advance: day 60 is bookable, day 61 is out of range', async () => {
    const day60 = await getDayAvailability({ menuSlug: 'cut', date: '2027-01-02' }, NOON)
    expect(day60?.status).toBe('available')
    const day61 = await getDayAvailability({ menuSlug: 'cut', date: '2027-01-03' }, NOON)
    expect(day61).toMatchObject({ status: 'out_of_range', slots: [] })
  })

  it('a block hides the slots that overlap it', async () => {
    await insertBlock(jst('2026-11-04 20:00'), jst('2026-11-04 21:00'))
    const day = await getDayAvailability({ menuSlug: 'cut', date: '2026-11-04' }, NOON)
    expect(startsOf(day, 'full')).toEqual(['19:30', '20:00', '20:30'])
    expect(startsOf(day, 'available')).toContain('19:00')
    expect(startsOf(day, 'available')).toContain('21:00')
  })

  it('a soft-deleted block has no effect', async () => {
    await insertBlock(jst('2026-11-04 20:00'), jst('2026-11-04 21:00'), true)
    const day = await getDayAvailability({ menuSlug: 'cut', date: '2026-11-04' }, NOON)
    expect(startsOf(day, 'full')).toEqual([])
  })

  it('19:00-20:00 booking: 18:30, 19:00, 19:30 full; 18:00 (ends 19:00) stays available', async () => {
    await insertRawBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'))
    const day = await getDayAvailability({ menuSlug: 'cut', date: '2026-11-04' }, NOON)
    expect(startsOf(day, 'full')).toEqual(['18:30', '19:00', '19:30'])
    expect(startsOf(day, 'available')).toContain('18:00')
    expect(startsOf(day, 'available')).toContain('20:00')
  })

  it('a booking ending 19:00 does not conflict with one starting 19:00 (half-open ranges)', async () => {
    await insertRawBooking(jst('2026-11-04 18:00'), jst('2026-11-04 19:00'))
    const day = await getDayAvailability({ menuSlug: 'cut', date: '2026-11-04' }, NOON)
    expect(startsOf(day, 'available')).toContain('19:00')
    // and the database agrees: inserting 19:00-20:00 succeeds
    await expect(insertRawBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'))).resolves.toBeUndefined()
  })

  it('cancelled bookings do not occupy slots', async () => {
    await insertRawBooking(jst('2026-11-04 19:00'), jst('2026-11-04 20:00'), 'cancelled_by_customer')
    const day = await getDayAvailability({ menuSlug: 'cut', date: '2026-11-04' }, NOON)
    expect(startsOf(day, 'full')).toEqual([])
  })

  it('returns null for an unknown or inactive menu', async () => {
    await db.execute(sql`UPDATE menus SET is_active = false WHERE slug = 'bleach'`)
    expect(await getDayAvailability({ menuSlug: 'bleach', date: '2026-11-04' }, NOON)).toBeNull()
    expect(await getDayAvailability({ menuSlug: 'nope', date: '2026-11-04' }, NOON)).toBeNull()
  })
})

describe('getMonthAvailability', () => {
  it('summarises every day of the month; past days are out of range', async () => {
    const month = await getMonthAvailability({ menuSlug: 'cut', month: '2026-11' }, NOON)
    expect(month?.days).toHaveLength(30)
    const byDate = Object.fromEntries((month?.days ?? []).map((d) => [d.date, d]))
    expect(byDate['2026-11-02']?.status).toBe('out_of_range') // yesterday
    expect(byDate['2026-11-03']?.status).toBe('available') // today, evening slots still open
    expect(byDate['2026-11-09']).toMatchObject({ status: 'closed', closedReason: 'regular' })
    expect(month?.prevMonth).toBeUndefined()
    expect(month?.nextMonth).toBe('2026-12')
    expect(month?.firstAvailableDate).toBe('2026-11-03')
  })

  it('agrees with the day query for the same date', async () => {
    await insertRawBooking(jst('2026-11-04 18:00'), jst('2026-11-05 00:00'))
    const month = await getMonthAvailability({ menuSlug: 'cut', month: '2026-11' }, NOON)
    const day = await getDayAvailability({ menuSlug: 'cut', date: '2026-11-04' }, NOON)
    expect(day?.status).toBe('full')
    expect(month?.days.find((d) => d.date === '2026-11-04')?.status).toBe(day?.status)
  })

  it('days after today + 60 are out of range; months outside the window are invalid', async () => {
    const jan = await getMonthAvailability({ menuSlug: 'cut', month: '2027-01' }, NOON)
    const byDate = Object.fromEntries((jan?.days ?? []).map((d) => [d.date, d.status]))
    expect(byDate['2027-01-02']).toBe('available')
    expect(byDate['2027-01-03']).toBe('out_of_range')
    expect(jan?.nextMonth).toBeUndefined()
    expect(await getMonthAvailability({ menuSlug: 'cut', month: '2027-02' }, NOON)).toBeNull()
    expect(await getMonthAvailability({ menuSlug: 'cut', month: '2026-10' }, NOON)).toBeNull()
  })
})

describe('schema guards', () => {
  it('has the bookings_no_overlap exclusion constraint (DZ-04)', async () => {
    const res = await db.execute<{ contype: string }>(
      sql`SELECT contype FROM pg_constraint WHERE conname = 'bookings_no_overlap'`,
    )
    expect(res.rows[0]?.contype).toBe('x')
  })

  it('rejects a closed-upper range via the half-open CHECK', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO time_blocks (during, kind)
        VALUES (tstzrange(now(), now() + interval '1 hour', '[]'), 'break')
      `),
    ).rejects.toMatchObject({ cause: { code: '23514' } })
  })
})
