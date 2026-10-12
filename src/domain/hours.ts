/**
 * Business-hours presentation helpers (S-C-01 access card, JSON-LD). Pure: no I/O, no Intl
 * time zone math — the inputs are minutes after JST midnight from `business_hours`.
 */

export type WeeklyHoursRow = {
  /** 0 = Sunday … 6 = Saturday (same as Postgres extract(dow)). */
  weekday: number
  isClosed: boolean
  openMin: number | null
  closeMin: number | null
}

export type HoursRange = { openMin: number; closeMin: number; weekdays: number[] }

export type HoursSummary = {
  /** Distinct opening ranges, each with the weekdays that use it (Monday-first order). */
  ranges: HoursRange[]
  /** Regular closing days, Monday-first order (the calendar is Monday-first, DG-001 §5.5). */
  closedWeekdays: number[]
}

/** Monday-first weekday order. */
export const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const

export function summarizeHours(rows: readonly WeeklyHoursRow[]): HoursSummary {
  const byDay = new Map(rows.map((r) => [r.weekday, r]))
  const ranges: HoursRange[] = []
  const closedWeekdays: number[] = []
  for (const weekday of MONDAY_FIRST) {
    const row = byDay.get(weekday)
    if (!row || row.isClosed || row.openMin === null || row.closeMin === null) {
      closedWeekdays.push(weekday)
      continue
    }
    const { openMin, closeMin } = row
    const existing = ranges.find((r) => r.openMin === openMin && r.closeMin === closeMin)
    if (existing) existing.weekdays.push(weekday)
    else ranges.push({ openMin, closeMin, weekdays: [weekday] })
  }
  return { ranges, closedWeekdays }
}

/**
 * Clock label for minutes after midnight. 1440 (end of day) is "24:00" in ja and
 * "12:00 AM" in en (01_sitemap.md §4.3, the 24:00 rule).
 */
export function formatClock(minutes: number, locale: string): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const mm = String(m).padStart(2, '0')
  if (locale === 'ja') return `${h}:${mm}`
  const h24 = h % 24
  const suffix = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm} ${suffix}`
}

export function formatRange(range: { openMin: number; closeMin: number }, locale: string): string {
  return `${formatClock(range.openMin, locale)}–${formatClock(range.closeMin, locale)}`
}

/** schema.org Time ("HH:MM"); a close at 24:00 is emitted as 23:59 (Google's guidance). */
export function schemaTime(minutes: number): string {
  const clamped = Math.min(minutes, 1439)
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** JSON-LD openingHoursSpecification (closed days are omitted, 01_sitemap.md §5.2). */
export function openingHoursSpecification(summary: HoursSummary) {
  return summary.ranges.map((r) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: r.weekdays.map((d) => SCHEMA_DAYS[d]),
    opens: schemaTime(r.openMin),
    closes: schemaTime(r.closeMin),
  }))
}

/**
 * Last offered start of a menu on a day (CR-15): the same grid as the availability SQL —
 * starts are open + k × step and [start, start + duration + buffer) must end by closing time.
 * `null` when the menu does not fit at all.
 */
export function lastStartMin(
  hours: { openMin: number; closeMin: number },
  menu: { durationMin: number; bufferAfterMin: number },
  slotStepMin: number,
): number | null {
  const latest = hours.closeMin - menu.durationMin - menu.bufferAfterMin
  if (latest < hours.openMin || slotStepMin <= 0) return null
  return hours.openMin + Math.floor((latest - hours.openMin) / slotStepMin) * slotStepMin
}
