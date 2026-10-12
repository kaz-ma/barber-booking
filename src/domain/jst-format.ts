import { addDays, jstDate, jstTime, TIME_ZONE, weekdayOf } from './time'

/*
 * Admin-side JST helpers (pure). Offsets are always looked up through Intl with the IANA zone
 * name — never a hard-coded "+09:00" (AGENTS.md rule 4).
 */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const

const offsetFormatter = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' })

/** Zone offset in minutes at `instant` (e.g. 540 for Asia/Tokyo). */
export function zoneOffsetMinutes(instant: Date): number {
  const name = offsetFormatter.formatToParts(instant).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

/** Instant of `date` (JST calendar day) + `minutes` after JST midnight. 1440 = next midnight. */
export function jstInstant(date: string, minutes: number): Date {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  const naive = Date.UTC(y, mo - 1, d, 0, minutes)
  // Two passes make this correct even for zones with DST transitions.
  let instant = new Date(naive - zoneOffsetMinutes(new Date(naive)) * 60_000)
  instant = new Date(naive - zoneOffsetMinutes(instant) * 60_000)
  return instant
}

/** Minutes after JST midnight of `date` (may be < 0 or > 1440 for instants on other days). */
export function minutesFromJstMidnight(instant: Date, date: string): number {
  return Math.round((instant.getTime() - jstInstant(date, 0).getTime()) / 60_000)
}

export function weekdayJa(date: string): string {
  return WEEKDAYS_JA[weekdayOf(date)] ?? ''
}

/** '10/10（土）' (UI, full-width parens) or '10/10(土)' (push titles). */
export function formatDateJa(date: string, parens: 'full' | 'half' = 'full'): string {
  const [, m, d] = date.split('-').map(Number)
  const wd = weekdayJa(date)
  return parens === 'full' ? `${m}/${d}（${wd}）` : `${m}/${d}(${wd})`
}

/** 'HH:mm' where an instant at the next JST midnight of `date` renders as 24:00. */
export function formatTimeOnDate(instant: Date, date: string): string {
  const min = minutesFromJstMidnight(instant, date)
  if (min === 1440) return '24:00'
  return jstTime(instant)
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 'HH:mm–HH:mm' on the JST day the range starts. */
export function formatRangeJa(start: Date, end: Date): string {
  const date = jstDate(start)
  return `${formatTimeOnDate(start, date)}–${formatTimeOnDate(end, date)}`
}

/** Floor an instant to `stepMin` minutes (block presets use 5). */
export function floorToMinutes(instant: Date, stepMin: number): Date {
  const step = stepMin * 60_000
  return new Date(Math.floor(instant.getTime() / step) * step)
}

/** Monday-start week containing `date` (JST calendar strings). */
export function weekStart(date: string): string {
  const wd = weekdayOf(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}
