import { jstDate, jstTime } from '@/domain/time'

/**
 * "18:00–19:00" / "6:00 PM–7:00 PM" with the 24:00 rule (01_sitemap.md §4.3):
 * an end at JST midnight on the following day is "24:00" in ja and "12:00 AM (midnight)" in en.
 * TODO(OI-02): confirm the English wording.
 */
export function formatTimeRange(start: Date, end: Date, locale: string, formatTime: (d: Date) => string): string {
  const endsAtMidnight = jstTime(end) === '00:00' && jstDate(end) !== jstDate(start)
  const endText = endsAtMidnight ? (locale === 'ja' ? '24:00' : '12:00 AM (midnight)') : formatTime(end)
  return `${formatTime(start)}–${endText}`
}
