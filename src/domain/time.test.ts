import { describe, expect, it } from 'vitest'
import { addDays, addMonths, isDateString, isMonthString, jstDate, monthBounds, toJstIso, weekdayOf } from './time'
import { isUuid } from './uuid'

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

describe('parameter validation (CR-10 / CR-11)', () => {
  it('isDateString accepts only real calendar dates', () => {
    for (const ok of ['2026-11-30', '2028-02-29', '2026-12-31']) expect(isDateString(ok)).toBe(true)
    for (const bad of ['2026-11-31', '2026-02-29', '2026-13-01', '2026-00-10', '2026-1-01', '', 'x', '2026-11-30T00'])
      expect(isDateString(bad)).toBe(false)
  })
  it('isMonthString accepts YYYY-MM only', () => {
    expect(isMonthString('2026-11')).toBe(true)
    for (const bad of ['2026-13', '2026-1', '2026-11-01']) expect(isMonthString(bad)).toBe(false)
  })
  it('isUuid checks the hyphen layout, not just the length', () => {
    expect(isUuid('6f1c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f')).toBe(true)
    expect(isUuid('-'.repeat(36))).toBe(false)
    expect(isUuid('6f1c1d2e3a4b4c5d8e9f0a1b2c3d4e5f----')).toBe(false)
  })
})
