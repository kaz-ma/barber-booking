import { describe, expect, it } from 'vitest'
import { buildIcs } from './ics'

describe('buildIcs', () => {
  const ics = buildIcs({
    uid: 'booking-123@example.com',
    start: new Date('2026-11-04T09:00:00Z'),
    end: new Date('2026-11-04T10:00:00Z'),
    summary: 'カット｜Neuer Barber',
    location: 'Neuer Barber, 大阪市阿倍野区阿倍野筋2-4-48 金村ビル3階南（B）',
    description: `キャンセル: https://example.com/ja/cancel/${'A'.repeat(43)}`,
    url: 'https://example.com/ja/book/done/x',
    alarmText: 'ご予約のお知らせ',
    now: new Date('2026-11-01T00:00:00Z'),
  })

  it('has UTC times, two alarms and CRLF line endings', () => {
    expect(ics).toContain('DTSTART:20261104T090000Z')
    expect(ics).toContain('DTEND:20261104T100000Z')
    expect(ics).toContain('TRIGGER:-P1D')
    expect(ics).toContain('TRIGGER:-PT1H')
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true)
  })
  it('escapes commas and folds lines to 75 octets', () => {
    expect(ics).toContain('LOCATION:Neuer Barber\\, ')
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain(`cancel/${'A'.repeat(43)}`)
  })
})
