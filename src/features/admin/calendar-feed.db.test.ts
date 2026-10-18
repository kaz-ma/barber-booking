import { beforeEach, describe, expect, it } from 'vitest'
import { insertNamedBooking, jst, resetDb } from '../../../test/db-helpers'
import { buildCalendarFeed, hasCalendarFeed, issueCalendarFeed, revokeCalendarFeed } from './calendar-feed'

/* B8 owner calendar feed (2026-10-18). */

beforeEach(resetDb)

describe('calendar feed', () => {
  it('serves the bookings for the issued token only, without customer names', async () => {
    await insertNamedBooking(jst('2026-11-05 19:00'), jst('2026-11-05 20:00'), { name: '山田 太郎' })
    await insertNamedBooking(jst('2026-11-06 19:00'), jst('2026-11-06 20:00'), { status: 'cancelled_by_owner' })
    expect(await hasCalendarFeed()).toBe(false)
    const issued = await issueCalendarFeed()
    if (issued.status !== 'ok') throw new Error('expected ok')
    expect(issued.data.webcalUrl).toMatch(/^webcal:\/\/localhost:3000\/api\/calendar\/[A-Za-z0-9_-]{43}$/)
    const token = issued.data.httpsUrl.split('/').pop() ?? ''

    const feed = await buildCalendarFeed(token, jst('2026-11-01 12:00'))
    expect(feed).toContain('BEGIN:VCALENDAR')
    expect(feed?.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(feed).toContain('SUMMARY:予約 カット')
    expect(feed).toContain('DTSTART:20261105T100000Z')
    expect(feed).not.toContain('山田')

    expect(await buildCalendarFeed('x'.repeat(43))).toBeNull()
    const again = await issueCalendarFeed()
    if (again.status !== 'ok') throw new Error('expected ok')
    expect(await buildCalendarFeed(token)).toBeNull()
    await revokeCalendarFeed()
    expect(await buildCalendarFeed(again.data.httpsUrl.split('/').pop() ?? '')).toBeNull()
    expect(await hasCalendarFeed()).toBe(false)
  })
})
