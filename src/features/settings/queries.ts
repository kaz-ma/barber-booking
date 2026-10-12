import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { menus, settings } from '@/lib/db/schema'

/*
 * Rarely-changing reference data, cached into the static shell (DES-00 §3.2, FR-S-12).
 * Admin actions invalidate with updateTag(CACHE_TAGS.menus | CACHE_TAGS.settings). Availability is NOT here
 * and is never cached. Booking writes re-read menus from the DB inside the transaction.
 */

export type MenuDTO = {
  slug: string
  name: { ja: string; en: string }
  description: { ja: string | null; en: string | null }
  priceJpy: number
  priceStudentJpy: number | null
  durationMin: number
}

export async function getActiveMenus(): Promise<MenuDTO[]> {
  'use cache'
  cacheTag(CACHE_TAGS.menus)
  cacheLife('days')
  const rows = await db
    .select()
    .from(menus)
    .where(eq(menus.isActive, true))
    .orderBy(asc(menus.sortOrder), asc(menus.slug))
  return rows.map((m) => ({
    slug: m.slug,
    name: { ja: m.nameJa, en: m.nameEn },
    description: { ja: m.descriptionJa, en: m.descriptionEn },
    priceJpy: m.priceJpy,
    priceStudentJpy: m.priceStudentJpy,
    durationMin: m.durationMin,
  }))
}

export type PublicSettingsDTO = { leadTimeMin: number; cancelDeadlineMin: number; maxAdvanceDays: number }

export async function getPublicSettings(): Promise<PublicSettingsDTO> {
  'use cache'
  cacheTag(CACHE_TAGS.settings)
  cacheLife('days')
  const [row] = await db
    .select({
      leadTimeMin: settings.leadTimeMin,
      cancelDeadlineMin: settings.cancelDeadlineMin,
      maxAdvanceDays: settings.maxAdvanceDays,
    })
    .from(settings)
    .limit(1)
  return row ?? { leadTimeMin: 60, cancelDeadlineMin: 120, maxAdvanceDays: 60 }
}
