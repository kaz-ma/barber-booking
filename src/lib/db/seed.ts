import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from './schema'
import { authUser, businessHours, menus, settings } from './schema'

/*
 * Initial data (04_data_model.md §5). Idempotent: existing rows are left untouched so admin
 * edits survive a re-seed. Prices stay 0 and menus inactive until OI-01 is answered — never
 * insert guessed prices. `activateMenus` exists only so local dev / tests can book.
 */

export const SEED_MENUS = [
  { sortOrder: 1, slug: 'cut', nameJa: 'カット', nameEn: 'Haircut' },
  { sortOrder: 2, slug: 'cut-perm', nameJa: 'カットパーマ', nameEn: 'Cut & Perm' },
  { sortOrder: 3, slug: 'cut-color', nameJa: 'カットカラー', nameEn: 'Cut & Color' },
  { sortOrder: 4, slug: 'special-perm', nameJa: '特殊パーマ', nameEn: 'Special Perm' },
  { sortOrder: 5, slug: 'bleach', nameJa: 'ブリーチ', nameEn: 'Bleach' },
  { sortOrder: 6, slug: 'retouch', nameJa: 'リタッチ', nameEn: 'Root Retouch' },
  { sortOrder: 7, slug: 'bleach-extra', nameJa: 'ブリーチ 2 回目以上', nameEn: 'Additional Bleach (2nd+)' },
  { sortOrder: 8, slug: 'braids-special', nameJa: '編み込み・特殊ヘア', nameEn: 'Braids & Special Styling' },
  { sortOrder: 9, slug: 'iron-perm', nameJa: 'アイロンパーマ（濡れパン）', nameEn: 'Iron Perm (Nurepan)' },
].map((m) => ({ ...m, priceJpy: 0, durationMin: 60, bufferAfterMin: 0, isActive: false }))

/** Mon closed; Sun, Tue-Sat 18:00-24:00 (1080-1440 min). OI-02 / OI-03 pending. */
export const SEED_BUSINESS_HOURS = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
  weekday === 1
    ? { weekday, isClosed: true, openMin: null, closeMin: null }
    : { weekday, isClosed: false, openMin: 1080, closeMin: 1440 },
)

export const SEED_SETTINGS = {
  id: 1,
  slotStepMin: 30,
  leadTimeMin: 60,
  maxAdvanceDays: 60,
  cancelDeadlineMin: 120,
  timezone: 'Asia/Tokyo',
  allowSameDay: true,
  digestHourJst: 21,
}

export async function seedReferenceData(
  db: NodePgDatabase<typeof schema>,
  opts: { activateMenus?: boolean; adminEmail?: string } = {},
): Promise<void> {
  await db.insert(menus).values(SEED_MENUS).onConflictDoNothing({ target: menus.slug })
  await db.insert(businessHours).values(SEED_BUSINESS_HOURS).onConflictDoNothing()
  await db.insert(settings).values(SEED_SETTINGS).onConflictDoNothing()
  if (opts.activateMenus) {
    await db.update(menus).set({ isActive: true }).where(sql`true`)
  }
  if (opts.adminEmail) {
    // Sign-up is disabled; the single admin is created here (FR-A-01). Login via OTP, then passkey.
    // Stored lower-case like scripts/seed-admin.ts and looked up lower-case (CR-23).
    await db
      .insert(authUser)
      .values({ id: randomUUID(), name: 'Owner', email: opts.adminEmail.trim().toLowerCase(), emailVerified: true })
      .onConflictDoNothing({ target: authUser.email })
  }
}
