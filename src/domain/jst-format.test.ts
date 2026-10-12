import { describe, expect, it } from 'vitest'
import {
  floorToMinutes,
  formatDateJa,
  formatRangeJa,
  formatTimeOnDate,
  jstInstant,
  minutesFromJstMidnight,
  weekStart,
  zoneOffsetMinutes,
} from './jst-format'

describe('admin JST formatting', () => {
  it('builds instants from JST wall time via the IANA zone', () => {
    expect(zoneOffsetMinutes(new Date('2026-11-04T00:00:00Z'))).toBe(540)
    expect(jstInstant('2026-11-04', 18 * 60).toISOString()).toBe('2026-11-04T09:00:00.000Z')
    expect(jstInstant('2026-11-04', 1440).toISOString()).toBe('2026-11-04T15:00:00.000Z')
  })
  it('measures minutes from JST midnight and renders 24:00', () => {
    const end = new Date('2026-11-04T15:00:00Z')
    expect(minutesFromJstMidnight(end, '2026-11-04')).toBe(1440)
    expect(formatTimeOnDate(end, '2026-11-04')).toBe('24:00')
    expect(formatRangeJa(new Date('2026-11-04T14:00:00Z'), end)).toBe('23:00–24:00')
  })
  it('formats dates with Japanese weekdays', () => {
    expect(formatDateJa('2026-10-10')).toBe('10/10（土）')
    expect(formatDateJa('2026-11-04', 'half')).toBe('11/4(水)')
  })
  it('floors to 5 minutes and finds the Monday of a week', () => {
    expect(floorToMinutes(new Date('2026-11-04T09:12:34Z'), 5).toISOString()).toBe('2026-11-04T09:10:00.000Z')
    expect(weekStart('2026-10-11')).toBe('2026-10-05') // Sunday -> previous Monday
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
  })
})
