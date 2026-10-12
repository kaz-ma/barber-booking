import 'server-only'
import { and, eq } from 'drizzle-orm'
import { cache } from 'react'
import { addDays, addMonths, isDateString, isMonthString, jstDate, monthBounds, monthOf, toJstIso } from '@/domain/time'
import { db } from '@/lib/db'
import {
  type ClosedReason,
  type DayStatus,
  queryAvailabilityDays,
  queryAvailabilityMonth,
  readAvailability,
  type SlotStatus,
} from '@/lib/db/availability-sql'
import { menus, settings } from '@/lib/db/schema'

/*
 * Availability DAL (06_api.md §2.2). Never cached across requests (D-04, FR-S-12): pages call
 * these under <Suspense>. `now` is injectable for deterministic tests.
 * Per-request de-duplication only: the exported functions delegate to React cache() wrappers
 * keyed by primitives (menu, dates, now in ms), so /book/time asking for the same month twice in
 * one render hits the DB once. React's cache() lives for one server request — nothing is shared
 * across requests (rule 3).
 */

export type SlotDTO = { startsAt: string; status: SlotStatus }
export type DayDTO = { date: string; status: DayStatus; closedReason?: ClosedReason }
export type DayAvailabilityDTO = DayDTO & { slots: SlotDTO[] }
export type MonthAvailabilityDTO = {
  month: string
  days: DayDTO[]
  prevMonth?: string
  nextMonth?: string
  firstAvailableDate?: string
}

const MAX_RANGE_DAYS = 14

async function isActiveMenu(menuSlug: string): Promise<boolean> {
  const rows = await db
    .select({ id: menus.id })
    .from(menus)
    .where(and(eq(menus.slug, menuSlug), eq(menus.isActive, true)))
    .limit(1)
  return rows.length > 0
}

async function maxAdvanceDays(): Promise<number> {
  const rows = await db.select({ v: settings.maxAdvanceDays }).from(settings).limit(1)
  return rows[0]?.v ?? 60
}

/** Every candidate slot (incl. full / deadline) per day; `null` when the menu is unknown/inactive. */
export function getAvailability(
  input: { menuSlug: string; from: string; to: string },
  now: Date = new Date(),
): Promise<DayAvailabilityDTO[] | null> {
  return availabilityPerRequest(input.menuSlug, input.from, input.to, now.getTime())
}

const availabilityPerRequest = cache(async function availability(
  menuSlug: string,
  from: string,
  to: string,
  nowMs: number,
): Promise<DayAvailabilityDTO[] | null> {
  const now = new Date(nowMs)
  if (!isDateString(from) || !isDateString(to) || from > to) return null
  if (addDays(from, MAX_RANGE_DAYS - 1) < to) return null
  if (!(await isActiveMenu(menuSlug))) return null
  const days = await readAvailability((tx) => queryAvailabilityDays(tx, { menuSlug, from, to, now }))
  return days.map((d) => ({
    date: d.date,
    status: d.status,
    ...(d.closedReason ? { closedReason: d.closedReason } : {}),
    slots: d.slots.map((s) => ({ startsAt: toJstIso(s.startsAt), status: s.status })),
  }))
})

/** Slot list for one JST date (S-C-03 after the v0.3 month calendar change). */
export async function getDayAvailability(
  input: { menuSlug: string; date: string },
  now: Date = new Date(),
): Promise<DayAvailabilityDTO | null> {
  const days = await getAvailability({ menuSlug: input.menuSlug, from: input.date, to: input.date }, now)
  return days?.[0] ?? null
}

/** Month calendar summary (§6.1). `null` = invalid month (outside today .. today + max advance). */
export function getMonthAvailability(
  input: { menuSlug: string; month: string },
  now: Date = new Date(),
): Promise<MonthAvailabilityDTO | null> {
  return monthPerRequest(input.menuSlug, input.month, now.getTime())
}

const monthPerRequest = cache(async function monthAvailability(
  menuSlug: string,
  month: string,
  nowMs: number,
): Promise<MonthAvailabilityDTO | null> {
  const now = new Date(nowMs)
  if (!isMonthString(month)) return null
  const today = jstDate(now)
  const firstMonth = monthOf(today)
  const lastMonth = monthOf(addDays(today, await maxAdvanceDays()))
  if (month < firstMonth || month > lastMonth) return null
  if (!(await isActiveMenu(menuSlug))) return null

  const { first, last } = monthBounds(month)
  const days = await readAvailability((tx) => queryAvailabilityMonth(tx, { menuSlug, from: first, to: last, now }))
  const prev = addMonths(month, -1)
  const next = addMonths(month, 1)
  return {
    month,
    days: days.map((d) => ({
      date: d.date,
      status: d.status,
      ...(d.closedReason ? { closedReason: d.closedReason } : {}),
    })),
    ...(prev >= firstMonth ? { prevMonth: prev } : {}),
    ...(next <= lastMonth ? { nextMonth: next } : {}),
    ...(() => {
      const firstAvailable = days.find((d) => d.status === 'available')?.date
      return firstAvailable ? { firstAvailableDate: firstAvailable } : {}
    })(),
  }
})
