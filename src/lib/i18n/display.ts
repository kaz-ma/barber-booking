import { TIME_ZONE } from '@/domain/time'
import { formatTimeRange } from './format'

/*
 * Customer-facing date / time / price labels (DG-001 §3, 01_sitemap.md §4.3). Instants are shown
 * in Asia/Tokyo via the IANA name; calendar dates ('YYYY-MM-DD') have no zone and are formatted
 * as UTC dates so the runtime zone never shifts them. Weekday brackets are full-width in ja.
 *   ja: 10月13日（火） / 19:00–20:00 / 2026年10月
 *   en: Tue, Oct 13 / 7:00 PM–8:00 PM / October 2026
 */

type Locale = 'ja' | 'en' | (string & {})

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function fmt(locale: string, zone: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${zone}|${JSON.stringify(opts)}`
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: zone, ...opts })
    fmtCache.set(key, f)
  }
  return f
}

function parts(f: Intl.DateTimeFormat, d: Date): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of f.formatToParts(d)) out[p.type] = p.value
  return out
}

/** A calendar date as a Date at UTC midnight (format with zone UTC). */
export function calendarDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function dayLabelFor(d: Date, zone: string, locale: Locale): string {
  if (locale === 'ja') {
    const p = parts(fmt('ja-JP', zone, { month: 'numeric', day: 'numeric', weekday: 'short' }), d)
    return `${p.month}月${p.day}日（${p.weekday}）`
  }
  return fmt('en-US', zone, { weekday: 'short', month: 'short', day: 'numeric' }).format(d)
}

/** "10月13日（火）" / "Tue, Oct 13" for a JST calendar date 'YYYY-MM-DD'. */
export function formatDateLabel(date: string, locale: Locale): string {
  return dayLabelFor(calendarDate(date), 'UTC', locale)
}

/** Same label for an instant, in JST. */
export function formatDayOf(instant: Date, locale: Locale): string {
  return dayLabelFor(instant, TIME_ZONE, locale)
}

/** Screen-reader date for calendar cells: "10月13日 火曜日" / "Tuesday, October 13". */
export function formatDateAria(date: string, locale: Locale): string {
  const d = calendarDate(date)
  if (locale === 'ja') {
    const p = parts(fmt('ja-JP', 'UTC', { month: 'numeric', day: 'numeric', weekday: 'long' }), d)
    return `${p.month}月${p.day}日 ${p.weekday}`
  }
  return fmt('en-US', 'UTC', { weekday: 'long', month: 'long', day: 'numeric' }).format(d)
}

/** "2026年10月" / "October 2026" for 'YYYY-MM'. */
export function formatMonthTitle(month: string, locale: Locale): string {
  const d = calendarDate(`${month}-01`)
  if (locale === 'ja') {
    const p = parts(fmt('ja-JP', 'UTC', { year: 'numeric', month: 'numeric' }), d)
    return `${p.year}年${p.month}月`
  }
  return fmt('en-US', 'UTC', { year: 'numeric', month: 'long' }).format(d)
}

/** "19:00" / "7:00 PM" in JST. */
export function formatTime(instant: Date, locale: Locale): string {
  return fmt(locale === 'ja' ? 'ja-JP' : 'en-US', TIME_ZONE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: locale !== 'ja',
  }).format(instant)
}

/** "19:00–20:00" / "7:00 PM–8:00 PM" (24:00 rule for an end at JST midnight). */
export function formatTimeSpan(start: Date, end: Date, locale: Locale): string {
  return formatTimeRange(start, end, locale, (d) => formatTime(d, locale))
}

/** "10月13日（火）17:00" / "Tue, Oct 13, 5:00 PM" */
export function formatDateTime(instant: Date, locale: Locale): string {
  return locale === 'ja'
    ? `${formatDayOf(instant, locale)}${formatTime(instant, locale)}`
    : `${formatDayOf(instant, locale)}, ${formatTime(instant, locale)}`
}

/** "¥5,000" (half-width yen in both locales; `null` for an unset price). */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('en-US')}`
}
