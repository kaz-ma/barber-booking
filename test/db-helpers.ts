import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { menus } from '@/lib/db/schema'
import { seedReferenceData } from '@/lib/db/seed'

/**
 * Clear all rows and re-seed reference data with bookable menus. DELETE (not TRUNCATE): on
 * tiny tables it is an order of magnitude faster and needs no ACCESS EXCLUSIVE locks.
 */
export async function resetDb(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of [
      'consents',
      'notification_log',
      'bookings',
      'customers',
      'time_blocks',
      'business_hour_overrides',
      'audit_log',
      'rate_limits',
      'daily_digests',
      'push_subscriptions',
      'menus',
      'business_hours',
      'settings',
      'auth_rate_limit',
      'auth_verification',
      'auth_passkey',
      'auth_account',
      'auth_session',
      'auth_user',
    ]) {
      await tx.execute(sql.raw(`DELETE FROM ${table}`))
    }
  })
  await seedReferenceData(db, { activateMenus: true })
  await db.execute(sql`UPDATE menus SET price_jpy = 5000, price_student_jpy = 4000 WHERE slug = 'cut'`)
}

export async function addMenu(slug: string, durationMin: number, bufferAfterMin = 0): Promise<void> {
  await db.insert(menus).values({
    slug,
    nameJa: slug,
    nameEn: slug,
    priceJpy: 6000,
    durationMin,
    bufferAfterMin,
    isActive: true,
    sortOrder: 99,
  })
}

/** JST wall time -> Date, e.g. jst('2026-11-04 19:00'). */
export function jst(local: string): Date {
  return new Date(`${local.replace(' ', 'T')}:00+09:00`)
}

/** Insert an active booking directly (bypasses the service; for fixtures and race tests). */
export async function insertRawBooking(start: Date, end: Date, status = 'confirmed'): Promise<void> {
  const customerId = randomUUID()
  await db.execute(sql`INSERT INTO customers (id, name) VALUES (${customerId}, 'Fixture')`)
  await db.execute(sql`
    INSERT INTO bookings (public_code, customer_id, menu_id, during, status, source, price_jpy, cancelled_at)
    SELECT ${randomCode()}, ${customerId}, id,
           tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
           ${status}::booking_status, 'manual', 0,
           CASE WHEN ${status} LIKE 'cancelled%' THEN now() END
    FROM menus WHERE slug = 'cut'
  `)
}

export async function insertBlock(start: Date, end: Date, deleted = false): Promise<void> {
  await db.execute(sql`
    INSERT INTO time_blocks (during, kind, deleted_at)
    VALUES (tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
            'break', ${deleted ? sql`now()` : sql`NULL`})
  `)
}

function randomCode(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * 32)]).join('')
}

/** Single admin user + one session row (admin tests; Better Auth tables, ADR-0006). */
export async function seedAdminSession(email = 'owner@example.com'): Promise<{ userId: string; sessionId: string }> {
  const userId = randomUUID()
  const sessionId = randomUUID()
  await db.execute(
    sql`INSERT INTO auth_user (id, name, email, email_verified) VALUES (${userId}, 'Owner', ${email}, true)`,
  )
  await db.execute(sql`
    INSERT INTO auth_session (id, user_id, token, expires_at)
    VALUES (${sessionId}, ${userId}, ${randomUUID()}, now() + interval '30 days')
  `)
  return { userId, sessionId }
}

/** Insert a booking with a named customer and return ids (admin tests). Web rows get a consent. */
export async function insertNamedBooking(
  start: Date,
  end: Date,
  opts: { name?: string; status?: string; source?: string; phone?: string | null; acknowledged?: boolean } = {},
): Promise<{ bookingId: string; customerId: string }> {
  const customerId = randomUUID()
  const bookingId = randomUUID()
  const status = opts.status ?? 'confirmed'
  const source = opts.source ?? 'phone'
  const web = source === 'web'
  const consentId = web ? randomUUID() : null
  const idem = web ? randomUUID().replace(/-/g, '').padEnd(64, '0') : null
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`INSERT INTO customers (id, name, phone_e164) VALUES (${customerId}, ${opts.name ?? '佐藤 健'}, ${opts.phone ?? null})`,
    )
    await tx.execute(sql`
      INSERT INTO bookings (id, public_code, customer_id, menu_id, during, status, source, price_jpy, cancelled_at,
                            idempotency_key, consent_id, acknowledged_at)
      SELECT ${bookingId}, ${randomCode()}, ${customerId}, id,
             tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
             ${status}::booking_status, ${source}::booking_source, 5000,
             CASE WHEN ${status} LIKE 'cancelled%' THEN now() END,
             ${idem}, ${consentId}, ${opts.acknowledged === false ? sql`NULL` : sql`now()`}
      FROM menus WHERE slug = 'cut'
    `)
    if (consentId) {
      await tx.execute(sql`
        INSERT INTO consents (id, customer_id, booking_id, kind, policy_version)
        VALUES (${consentId}, ${customerId}, ${bookingId}, 'booking_policy', 'test')
      `)
    }
  })
  return { bookingId, customerId }
}
