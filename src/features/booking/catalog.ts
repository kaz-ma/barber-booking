import 'server-only'
import { asc } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import type { WeeklyHoursRow } from '@/domain/hours'
import { db } from '@/lib/db'
import { businessHours, menus } from '@/lib/db/schema'

/*
 * Read models for the public top page (S-C-01). Reference data only — cached into the static
 * shell like features/settings (DES-00 §3.2). Availability is never read here.
 *
 * The top page lists every menu, including ones still inactive until prices are confirmed
 * (OI-01): they render as "¥—" information cards and are not bookable (the /book step only
 * offers active menus). Admin edits invalidate with updateTag('menus') / updateTag('settings')
 * — 'business-hours' is also tagged so a dedicated hours tag works too.
 */

export type MenuCatalogItem = {
  slug: string
  name: { ja: string; en: string }
  description: { ja: string | null; en: string | null }
  priceJpy: number
  priceStudentJpy: number | null
  durationMin: number
  isActive: boolean
}

export async function getMenuCatalog(): Promise<MenuCatalogItem[]> {
  'use cache'
  cacheTag('menus')
  cacheLife('days')
  const rows = await db.select().from(menus).orderBy(asc(menus.sortOrder), asc(menus.slug))
  return rows.map((m) => ({
    slug: m.slug,
    name: { ja: m.nameJa, en: m.nameEn },
    description: { ja: m.descriptionJa, en: m.descriptionEn },
    priceJpy: m.priceJpy,
    priceStudentJpy: m.priceStudentJpy,
    durationMin: m.durationMin,
    isActive: m.isActive,
  }))
}

export async function getWeeklyHours(): Promise<WeeklyHoursRow[]> {
  'use cache'
  cacheTag('settings', 'business-hours')
  cacheLife('days')
  const rows = await db
    .select({
      weekday: businessHours.weekday,
      isClosed: businessHours.isClosed,
      openMin: businessHours.openMin,
      closeMin: businessHours.closeMin,
    })
    .from(businessHours)
    .orderBy(asc(businessHours.weekday))
  return rows
}
