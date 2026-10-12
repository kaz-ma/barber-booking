import { formatMinutes, jstInstant, minutesFromJstMidnight } from '@/domain/jst-format'
import { jstDate, toJstIso } from '@/domain/time'

/** Client-safe time helpers shared by the admin views (pure; IANA zone via Intl). */
export const hhmm = (min: number) => formatMinutes(min)

/** 'HH:MM' of a JST ISO string relative to `date` (24:00 for the next midnight). */
export function hhmmOn(iso: string, date: string): string {
  const min = minutesFromJstMidnight(new Date(iso), date)
  return formatMinutes(Math.max(0, min))
}

export function nowMinutes(date: string, now: Date = new Date()): number {
  return minutesFromJstMidnight(now, date)
}

export function isoAt(date: string, min: number): string {
  return toJstIso(jstInstant(date, min))
}

export function todayJst(now: Date = new Date()): string {
  return jstDate(now)
}

export function floor5(min: number): number {
  return Math.floor(min / 5) * 5
}
