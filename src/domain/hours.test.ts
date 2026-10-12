import { describe, expect, it } from 'vitest'
import { formatClock, formatRange, lastStartMin, openingHoursSpecification, schemaTime, summarizeHours } from './hours'

const SEED = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
  weekday === 1
    ? { weekday, isClosed: true, openMin: null, closeMin: null }
    : { weekday, isClosed: false, openMin: 1080, closeMin: 1440 },
)

describe('summarizeHours', () => {
  it('groups identical ranges Monday-first and lists closed days', () => {
    const s = summarizeHours(SEED)
    expect(s.closedWeekdays).toEqual([1])
    expect(s.ranges).toEqual([{ openMin: 1080, closeMin: 1440, weekdays: [2, 3, 4, 5, 6, 0] }])
  })

  it('treats missing rows as closed and keeps distinct ranges apart', () => {
    const s = summarizeHours([
      { weekday: 6, isClosed: false, openMin: 600, closeMin: 1200 },
      { weekday: 2, isClosed: false, openMin: 1080, closeMin: 1440 },
    ])
    expect(s.ranges.map((r) => r.weekdays)).toEqual([[2], [6]])
    expect(s.closedWeekdays).toEqual([1, 3, 4, 5, 0])
  })
})

describe('formatClock / formatRange', () => {
  it('uses 24:00 for the end of the day in ja', () => {
    expect(formatRange({ openMin: 1080, closeMin: 1440 }, 'ja')).toBe('18:00–24:00')
  })

  it('uses a 12-hour clock in en with midnight as 12:00 AM', () => {
    expect(formatRange({ openMin: 1080, closeMin: 1440 }, 'en')).toBe('6:00 PM–12:00 AM')
    expect(formatClock(0, 'en')).toBe('12:00 AM')
    expect(formatClock(720, 'en')).toBe('12:00 PM')
    expect(formatClock(570, 'en')).toBe('9:30 AM')
  })
})

describe('JSON-LD helpers', () => {
  it('clamps 24:00 to 23:59 and omits closed days', () => {
    expect(schemaTime(1440)).toBe('23:59')
    expect(openingHoursSpecification(summarizeHours(SEED))).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '18:00',
        closes: '23:59',
      },
    ])
  })
})

describe('lastStartMin (CR-15)', () => {
  const hours = { openMin: 18 * 60, closeMin: 24 * 60 }
  it('snaps to the slot grid from the opening time', () => {
    expect(lastStartMin(hours, { durationMin: 60, bufferAfterMin: 15 }, 30)).toBe(22 * 60 + 30)
    expect(lastStartMin(hours, { durationMin: 60, bufferAfterMin: 0 }, 30)).toBe(23 * 60)
    expect(lastStartMin(hours, { durationMin: 90, bufferAfterMin: 0 }, 60)).toBe(22 * 60)
    expect(lastStartMin({ openMin: 18 * 60 + 15, closeMin: 24 * 60 }, { durationMin: 60, bufferAfterMin: 0 }, 30)).toBe(
      22 * 60 + 45,
    )
  })
  it('null when the menu does not fit', () => {
    expect(lastStartMin(hours, { durationMin: 400, bufferAfterMin: 0 }, 30)).toBeNull()
  })
})
