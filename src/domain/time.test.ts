import { describe, expect, it } from 'vitest'
import { addDays, addMonths, jstDate, monthBounds, toJstIso, weekdayOf } from './time'

describe('JST helpers', () => {
  it('attributes instants to the JST calendar day (UTC 15:00 boundary)', () => {
    expect(jstDate(new Date('2026-11-03T14:59:59Z'))).toBe('2026-11-03')
    expect(jstDate(new Date('2026-11-03T15:00:00Z'))).toBe('2026-11-04')
  })
  it('formats ISO with the zone offset', () => {
    expect(toJstIso(new Date('2026-11-04T09:00:00Z'))).toBe('2026-11-04T18:00:00+09:00')
  })
  it('does calendar arithmetic', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(monthBounds('2027-02')).toEqual({ first: '2027-02-01', last: '2027-02-28' })
    expect(weekdayOf('2026-11-09')).toBe(1) // Monday
  })
})
