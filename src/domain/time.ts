/**
 * JST calendar helpers (D-05, NFR-EN-07). Uses the IANA zone name via Intl — never a
 * hard-coded offset. Calendar arithmetic on 'YYYY-MM-DD' strings is zone-free (Date.UTC).
 */
export const TIME_ZONE = 'Asia/Tokyo'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'longOffset',
})

function zonedParts(instant: Date) {
  const p: Record<string, string> = {}
  for (const { type, value } of partsFormatter.formatToParts(instant)) p[type] = value
  // longOffset is "GMT+09:00"
  const offset = (p.timeZoneName ?? 'GMT').replace('GMT', '') || '+00:00'
  return { ...p, offset } as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'offset', string>
}

/** JST calendar date of an instant, 'YYYY-MM-DD'. */
export function jstDate(instant: Date): string {
  const p = zonedParts(instant)
  return `${p.year}-${p.month}-${p.day}`
}

/** ISO 8601 with the JST offset, e.g. 2026-11-04T18:00:00+09:00 (form wire format, U-03). */
export function toJstIso(instant: Date): string {
  const p = zonedParts(instant)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${p.offset}`
}

/** 'HH:mm' in JST; an instant at JST midnight that ends a day is rendered by callers. */
export function jstTime(instant: Date): string {
  const p = zonedParts(instant)
  return `${p.hour}:${p.minute}`
}

/**
 * A real calendar date 'YYYY-MM-DD' (CR-10). Date.parse rolls '2026-11-31' over to Dec 1, so the
 * parsed date must format back to the same string; otherwise Postgres would reject the `::date`
 * cast with a 500.
 */
export function isDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function isMonthString(s: string): boolean {
  return MONTH_RE.test(s)
}

function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function fromUtcDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const d = toUtcDate(date)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtcDate(d)
}

/** 0 = Sunday … 6 = Saturday (same as Postgres extract(dow)). */
export function weekdayOf(date: string): number {
  return toUtcDate(date).getUTCDay()
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return fromUtcDate(d).slice(0, 7)
}

export function monthBounds(month: string): { first: string; last: string } {
  const first = `${month}-01`
  const last = addDays(`${addMonths(month, 1)}-01`, -1)
  return { first, last }
}
