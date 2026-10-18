import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { jpegSize } from '@/domain/jpeg'
import { jstDate, toJstIso } from '@/domain/time'
import type { ActionResult } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { db } from '@/lib/db'
import { consents, customers, kartePhotos } from '@/lib/db/schema'

/*
 * B3 カルテ and B6 再来店 (2026-10-18). Notes and photos are PII: they never reach logs,
 * audit diffs or push payloads, they are deleted on anonymization and included in the export.
 */

type Ctx = { now?: Date }

const invalidField = (field: string, key: string) => ({ status: 'invalid' as const, fieldErrors: { [field]: [key] } })

/** Whole-database cap for photos (Neon Free has 0.5 GB for everything). */
export const PHOTO_STORAGE_CAP = 300 * 1024 * 1024
export const PHOTOS_PER_VISIT = 6
export const PHOTO_MAX_BYTES = 600 * 1024
/** consents.policy_version for a photo agreement the owner recorded in the shop. */
const OWNER_PHOTO_CONSENT = 'owner-recorded-1'

async function bookingOwner(bookingId: string) {
  const res = await db.execute<{ id: string; customer_id: string }>(
    sql`SELECT id, customer_id FROM bookings WHERE id = ${bookingId} AND deleted_at IS NULL`,
  )
  return res.rows[0] ?? null
}

/** Saves this visit's notes (creates the visit's record on first write). */
export async function saveKarteNote(
  input: { bookingId: string; body: string },
  ctx: Ctx = {},
): Promise<ActionResult<null>> {
  const now = ctx.now ?? new Date()
  const b = await bookingOwner(input.bookingId)
  if (!b) return { status: 'not_found' }
  const body = input.body.trim() === '' ? null : input.body
  await db.transaction(async (tx) => {
    const res = await tx.execute<{ id: string }>(sql`
      INSERT INTO karte_records (customer_id, booking_id, body, created_at, updated_at)
      VALUES (${b.customer_id}, ${b.id}, ${body}, ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz)
      ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL
      DO UPDATE SET body = EXCLUDED.body, updated_at = EXCLUDED.updated_at
      RETURNING id`)
    await audit(tx, { actor: 'owner', action: 'karte.note', entityType: 'karte', entityId: res.rows[0]?.id ?? b.id })
  })
  return { status: 'ok', data: null }
}

/** Adds a photo to this visit. The first photo of a customer needs the owner's consent tick. */
export async function addKartePhoto(
  input: { bookingId: string; consent: boolean; bytes: Uint8Array },
  ctx: Ctx = {},
): Promise<ActionResult<{ photoId: string }>> {
  const now = ctx.now ?? new Date()
  if (input.bytes.length < 100 || input.bytes.length > PHOTO_MAX_BYTES) return invalidField('photo', 'photoTooLarge')
  const size = jpegSize(input.bytes)
  if (!size || size.width > 4096 || size.height > 4096) return invalidField('photo', 'photoInvalid')
  const b = await bookingOwner(input.bookingId)
  if (!b) return { status: 'not_found' }
  return db.transaction(async (tx) => {
    const used = await tx.execute<{ n: string }>(
      sql`SELECT coalesce(sum(octet_length(data)), 0)::text AS n FROM karte_photos`,
    )
    if (Number(used.rows[0]?.n ?? 0) + input.bytes.length > PHOTO_STORAGE_CAP)
      return invalidField('photo', 'photoStorageFull')
    const [consent] = await tx
      .select({ id: consents.id })
      .from(consents)
      .where(and(eq(consents.customerId, b.customer_id), eq(consents.kind, 'photo_karte'), isNull(consents.revokedAt)))
      .limit(1)
    let consentId = consent?.id
    if (!consentId) {
      if (!input.consent) return invalidField('consent', 'photoConsentRequired')
      const [row] = await tx
        .insert(consents)
        .values({
          customerId: b.customer_id,
          bookingId: b.id,
          kind: 'photo_karte',
          policyVersion: OWNER_PHOTO_CONSENT,
          acceptedAt: now,
        })
        .returning({ id: consents.id })
      consentId = row?.id
    }
    if (!consentId) throw new Error('consent insert returned no row')
    const rec = await tx.execute<{ id: string }>(sql`
      INSERT INTO karte_records (customer_id, booking_id, created_at, updated_at)
      VALUES (${b.customer_id}, ${b.id}, ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz)
      ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL DO UPDATE SET updated_at = EXCLUDED.updated_at
      RETURNING id`)
    const karteId = rec.rows[0]?.id
    if (!karteId) throw new Error('karte upsert returned no row')
    const count = await tx.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM karte_photos WHERE karte_id = ${karteId}`,
    )
    if ((count.rows[0]?.n ?? 0) >= PHOTOS_PER_VISIT) return invalidField('photo', 'photoTooMany')
    const [photo] = await tx
      .insert(kartePhotos)
      .values({
        karteId,
        customerId: b.customer_id,
        consentId,
        contentType: 'image/jpeg',
        data: Buffer.from(input.bytes),
        width: size.width,
        height: size.height,
        createdAt: now,
      })
      .returning({ id: kartePhotos.id })
    if (!photo) throw new Error('photo insert returned no row')
    await audit(tx, { actor: 'owner', action: 'karte.photo_add', entityType: 'karte', entityId: karteId })
    return { status: 'ok', data: { photoId: photo.id } }
  })
}

export async function deleteKartePhoto(photoId: string): Promise<ActionResult<null>> {
  return db.transaction(async (tx) => {
    const res = await tx.execute<{ karte_id: string }>(
      sql`DELETE FROM karte_photos WHERE id = ${photoId} RETURNING karte_id`,
    )
    const row = res.rows[0]
    if (!row) return { status: 'not_found' }
    await audit(tx, { actor: 'owner', action: 'karte.photo_delete', entityType: 'karte', entityId: row.karte_id })
    return { status: 'ok', data: null }
  })
}

export async function readKartePhoto(photoId: string): Promise<{ contentType: string; data: Buffer } | null> {
  const [row] = await db
    .select({ contentType: kartePhotos.contentType, data: kartePhotos.data })
    .from(kartePhotos)
    .where(eq(kartePhotos.id, photoId))
    .limit(1)
  return row ?? null
}

export type KarteEntry = {
  id: string
  bookingId: string | null
  /** JST date of the visit (booking start, else when the note was written). */
  date: string
  menuName: string | null
  body: string | null
  photos: { id: string; width: number; height: number }[]
}

type EntryRow = {
  id: string
  booking_id: string | null
  at: string
  menu_name: string | null
  body: string | null
  photos: { id: string; width: number; height: number }[] | null
}

const ENTRY_SELECT = sql`
  SELECT k.id, k.booking_id, coalesce(lower(b.during), k.created_at) AS at, m.name_ja AS menu_name, k.body,
         (SELECT json_agg(json_build_object('id', p.id, 'width', p.width, 'height', p.height) ORDER BY p.created_at)
            FROM karte_photos p WHERE p.karte_id = k.id) AS photos
  FROM karte_records k
  LEFT JOIN bookings b ON b.id = k.booking_id
  LEFT JOIN menus m ON m.id = b.menu_id`

const toEntry = (r: EntryRow): KarteEntry => ({
  id: r.id,
  bookingId: r.booking_id,
  date: jstDate(new Date(r.at)),
  menuName: r.menu_name,
  body: r.body,
  photos: r.photos ?? [],
})

const hasContent = (e: KarteEntry) => (e.body !== null && e.body.trim() !== '') || e.photos.length > 0

export type BookingKarte = {
  customerId: string
  hasPhotoConsent: boolean
  current: KarteEntry | null
  /** The latest earlier visit with notes or photos. */
  previous: KarteEntry | null
}

export async function getBookingKarte(bookingId: string): Promise<BookingKarte | null> {
  const res = await db.execute<{ customer_id: string; start_at: string; consent: boolean }>(sql`
    SELECT b.customer_id, lower(b.during) AS start_at,
           EXISTS (SELECT 1 FROM consents c WHERE c.customer_id = b.customer_id AND c.kind = 'photo_karte'
                   AND c.revoked_at IS NULL) AS consent
    FROM bookings b WHERE b.id = ${bookingId}`)
  const b = res.rows[0]
  if (!b) return null
  const [current, previous] = await Promise.all([
    db.execute<EntryRow>(sql`${ENTRY_SELECT} WHERE k.booking_id = ${bookingId}`),
    db.execute<EntryRow>(sql`${ENTRY_SELECT}
      WHERE k.customer_id = ${b.customer_id} AND (k.booking_id IS NULL OR k.booking_id <> ${bookingId})
        AND coalesce(lower(b.during), k.created_at) < ${b.start_at}::timestamptz
      ORDER BY coalesce(lower(b.during), k.created_at) DESC LIMIT 5`),
  ])
  const prev = previous.rows.map(toEntry).find(hasContent) ?? null
  return {
    customerId: b.customer_id,
    hasPhotoConsent: b.consent,
    current: current.rows[0] ? toEntry(current.rows[0]) : null,
    previous: prev,
  }
}

export async function getCustomerKarte(customerId: string): Promise<KarteEntry[]> {
  const res = await db.execute<EntryRow>(sql`${ENTRY_SELECT}
    WHERE k.customer_id = ${customerId}
    ORDER BY coalesce(lower(b.during), k.created_at) DESC LIMIT 50`)
  return res.rows.map(toEntry).filter(hasContent)
}

/** The latest note of a customer, for the "next customer" card (B4). */
export async function latestKarteNote(customerId: string, before: Date): Promise<KarteEntry | null> {
  const res = await db.execute<EntryRow>(sql`${ENTRY_SELECT}
    WHERE k.customer_id = ${customerId} AND coalesce(lower(b.during), k.created_at) < ${before.toISOString()}::timestamptz
    ORDER BY coalesce(lower(b.during), k.created_at) DESC LIMIT 5`)
  return res.rows.map(toEntry).find(hasContent) ?? null
}

// ---------------------------------------------------------------- B6 再来店

export async function setInstagramHandle(input: {
  customerId: string
  handle: string | null
}): Promise<ActionResult<null>> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(customers)
      .set({ instagramHandle: input.handle })
      .where(and(eq(customers.id, input.customerId), isNull(customers.anonymizedAt)))
      .returning({ id: customers.id })
    if (updated.length === 0) return { status: 'not_found' }
    await audit(tx, {
      actor: 'owner',
      action: 'customer.instagram',
      entityType: 'customer',
      entityId: input.customerId,
    })
    return { status: 'ok', data: null }
  })
}

export async function markReminded(
  input: { customerId: string; undo?: boolean },
  ctx: Ctx = {},
): Promise<ActionResult<null>> {
  const now = ctx.now ?? new Date()
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(customers)
      .set({ lastRemindedAt: input.undo ? null : now })
      .where(eq(customers.id, input.customerId))
      .returning({ id: customers.id })
    if (updated.length === 0) return { status: 'not_found' }
    await audit(tx, {
      actor: 'owner',
      action: 'customer.reminded',
      entityType: 'customer',
      entityId: input.customerId,
      diff: { undo: Boolean(input.undo) },
    })
    return { status: 'ok', data: null }
  })
}

export type RevisitItem = {
  customerId: string
  name: string
  instagramHandle: string | null
  lastVisit: string
  weeks: number
  menuSlug: string | null
  menuName: string | null
  locale: 'ja' | 'en'
}

/**
 * Customers whose last visit was at least `weeks` ago (and less than a year), with no upcoming
 * booking and no reminder since that visit. Oldest first is not useful here: the most "due"
 * (just past the interval) come first, so the list stays short and timely.
 */
export async function getRevisitList(input: { weeks: number }, now: Date = new Date()): Promise<RevisitItem[]> {
  const t = now.toISOString()
  const res = await db.execute<{
    id: string
    name: string
    instagram_handle: string | null
    last_visit_at: string
    menu_slug: string | null
    menu_name: string | null
    locale: 'ja' | 'en'
  }>(sql`
    SELECT c.id, c.name, c.instagram_handle, c.last_visit_at, c.locale,
           (SELECT m.slug FROM bookings b JOIN menus m ON m.id = b.menu_id
             WHERE b.customer_id = c.id AND b.status = 'completed' ORDER BY lower(b.during) DESC LIMIT 1) AS menu_slug,
           (SELECT m.name_ja FROM bookings b JOIN menus m ON m.id = b.menu_id
             WHERE b.customer_id = c.id AND b.status = 'completed' ORDER BY lower(b.during) DESC LIMIT 1) AS menu_name
    FROM customers c
    WHERE c.anonymized_at IS NULL AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL
      AND c.name IS NOT NULL AND c.booking_restriction = 'none'
      AND c.last_visit_at <= ${t}::timestamptz - make_interval(weeks => ${input.weeks})
      AND c.last_visit_at > ${t}::timestamptz - interval '1 year'
      AND (c.last_reminded_at IS NULL OR c.last_reminded_at < c.last_visit_at)
      AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = c.id
                        AND b.status IN ('confirmed', 'arrived', 'in_progress') AND upper(b.during) > ${t}::timestamptz)
    ORDER BY c.last_visit_at DESC
    LIMIT 100`)
  return res.rows.map((r) => ({
    customerId: r.id,
    name: r.name,
    instagramHandle: r.instagram_handle,
    lastVisit: toJstIso(new Date(r.last_visit_at)),
    weeks: Math.floor((now.getTime() - new Date(r.last_visit_at).getTime()) / (7 * 86_400_000)),
    menuSlug: r.menu_slug,
    menuName: r.menu_name,
    locale: r.locale,
  }))
}

// ---------------------------------------------------------------- B4 次のお客様

export type NextCustomer = {
  bookingId: string
  start: string
  name: string | null
  menuName: string
  /** true while the booking is running (施術中): the card then shows it until it ends. */
  now: boolean
  karte: KarteEntry | null
}

/**
 * The booking to get ready for (B4; no push without an external scheduler, owner decision
 * 2026-10-18): the one running now, otherwise the next one today, with that customer's latest
 * karte. Shown at the top of today's list.
 */
export async function getNextCustomer(now: Date = new Date()): Promise<NextCustomer | null> {
  const t = now.toISOString()
  const res = await db.execute<{
    id: string
    customer_id: string
    start_at: string
    status: string
    name: string | null
    menu_name: string
  }>(sql`
    SELECT b.id, b.customer_id, lower(b.during) AS start_at, b.status, c.name, m.name_ja AS menu_name
    FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN menus m ON m.id = b.menu_id
    WHERE b.deleted_at IS NULL AND b.status IN ('confirmed', 'arrived', 'in_progress')
      AND upper(b.during) - make_interval(mins => b.buffer_min) > ${t}::timestamptz
      AND (lower(b.during) AT TIME ZONE 'Asia/Tokyo')::date = (${t}::timestamptz AT TIME ZONE 'Asia/Tokyo')::date
    ORDER BY lower(b.during) LIMIT 1`)
  const r = res.rows[0]
  if (!r) return null
  const start = new Date(r.start_at)
  return {
    bookingId: r.id,
    start: toJstIso(start),
    name: r.name,
    menuName: r.menu_name,
    now: start.getTime() <= now.getTime(),
    karte: await latestKarteNote(r.customer_id, start),
  }
}
