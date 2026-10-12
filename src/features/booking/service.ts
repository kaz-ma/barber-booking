import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { ACTIVE_STATUSES } from '@/domain/booking-status'
import { phoneTail } from '@/domain/phone'
import { applicablePrice } from '@/domain/pricing'
import { jstDate } from '@/domain/time'
import { POLICY_VERSION } from '@/config/shop'
import type { ActionResult } from '@/lib/action-result'
import { invalid } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { db, type Tx } from '@/lib/db'
import { queryAvailabilityDays } from '@/lib/db/availability-sql'
import { bookings, consents, customers, menus, settings } from '@/lib/db/schema'
import { piiHmac, sha256, sha256Hex } from '@/lib/hash'
import { logger } from '@/lib/logger'
import { CONSTRAINTS, isExclusionViolation, isUniqueViolation } from '@/lib/pg-errors'
import { checkPhoneDaily, hitWindow, incrementPhoneDaily, LIMITS, rateKeys } from '@/lib/rate-limit'
import { generatePublicCode, hashCancelToken, hashesEqual, isCancelTokenFormat, issueCancelToken } from '@/lib/tokens'
import { verifyTurnstile } from '@/lib/turnstile'
import { type CreateBookingInput, cancelBookingSchema, createBookingSchema, type Locale } from './schema'

/*
 * Booking service (05_state_and_flows.md §2-3, 08_security.md §3). `actions.ts` stays thin
 * ('use server', headers(), after()) and delegates here so the whole pipeline is testable
 * against a real Postgres without a Next.js request context.
 *
 * Concurrency model (ADR-0003): READ COMMITTED + pg_advisory_xact_lock(calendar, resource)
 * serialises every calendar write (bookings, blocks, undo), which also prevents write skew
 * with time_blocks (they are outside the EXCLUDE constraint). The EXCLUDE constraint is the
 * final guard: even if the lock were bypassed, a second overlapping INSERT fails with 23P01.
 */

export type RequestContext = {
  ip: string
  userAgent: string | null
  /** Injectable clock for tests; defaults to the real time. */
  now?: Date
}

export type CreateBookingResult = {
  result: ActionResult<{ doneUrl: string }>
  /** Set when a booking was created; the caller schedules the owner push in after(). */
  createdBookingId?: string
}

const RESOURCE_ID = 1

/** Aborts the transaction with an expected (non-exceptional) result. */
class Abort extends Error {
  constructor(readonly result: ActionResult<never>) {
    super(result.status)
  }
}

function errorResult(err: unknown, event: string): ActionResult<never> {
  const digest = randomUUID().slice(0, 8)
  logger.error(event, {
    digest,
    error: err instanceof Error ? err.message : String(err),
  })
  return { status: 'error', digest }
}

const doneUrl = (locale: Locale, rawToken: string) => `/${locale}/book/done/${rawToken}`

async function lockCalendar(tx: Tx): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('calendar'), ${RESOURCE_ID})`)
}

/** sha256(startsAt | menuId | phone) — same person, same slot, same menu (FR-S-01). */
function idempotencyKeyOf(startsAt: Date, menuId: string, phoneE164: string): string {
  return sha256Hex(`${startsAt.toISOString()}|${menuId}|${phoneE164}`)
}

/**
 * Same browser re-submitting (submission nonce matches): re-issue the token and return the
 * existing booking. Anyone else gets `duplicate` with no details (G-04, T-05).
 */
async function resolveExistingByIdempotency(
  tx: Tx,
  idempotencyKey: string,
  nonce: string,
  locale: Locale,
): Promise<ActionResult<{ doneUrl: string }> | null> {
  const [existing] = await tx
    .select({ id: bookings.id, nonceHash: bookings.submissionNonceHash })
    .from(bookings)
    .where(and(eq(bookings.idempotencyKey, idempotencyKey), inArray(bookings.status, [...ACTIVE_STATUSES])))
    .for('update')
    .limit(1)
  if (!existing) return null
  if (!existing.nonceHash || !hashesEqual(existing.nonceHash, sha256(nonce))) {
    return { status: 'duplicate' }
  }
  const token = issueCancelToken()
  await tx.update(bookings).set({ cancelTokenHash: token.hash }).where(eq(bookings.id, existing.id))
  return { status: 'ok', data: { doneUrl: doneUrl(locale, token.raw) } }
}

async function insertBooking(
  input: CreateBookingInput,
  rawPhone: string,
  ctx: Required<RequestContext>,
): Promise<{ result: ActionResult<{ doneUrl: string }>; bookingId?: string }> {
  const startsAt = new Date(input.startsAt)
  return db.transaction(async (tx) => {
    await lockCalendar(tx)

    const [menu] = await tx
      .select()
      .from(menus)
      .where(and(eq(menus.slug, input.menuSlug), eq(menus.isActive, true)))
      .limit(1)
    if (!menu) throw new Abort({ status: 'invalid', fieldErrors: {}, reason: 'not_bookable' })

    const idempotencyKey = idempotencyKeyOf(startsAt, menu.id, input.phone)
    const existing = await resolveExistingByIdempotency(tx, idempotencyKey, input.submissionNonce, input.locale)
    if (existing) return { result: existing }

    // Re-check the slot with the same SQL the UI used (cached values must never be trusted:
    // a stale duration could book an overlapping range). Runs under the lock (T-02).
    const [day] = await queryAvailabilityDays(tx, {
      menuSlug: menu.slug,
      from: jstDate(startsAt),
      to: jstDate(startsAt),
      now: ctx.now,
    })
    const slot = day?.slots.find((s) => s.startsAt.getTime() === startsAt.getTime())
    if (!slot || slot.status === 'deadline') {
      throw new Abort({ status: 'invalid', fieldErrors: {}, reason: 'not_bookable' })
    }
    if (slot.status === 'full') throw new Abort({ status: 'conflict', reason: 'slot_taken' })

    const [conf] = await tx.select({ cancelDeadlineMin: settings.cancelDeadlineMin }).from(settings).limit(1)
    const cancelDeadlineMin = conf?.cancelDeadlineMin ?? 120

    // Customers are the single source of PII (ADR-0008): upsert by phone, never snapshot.
    const [customer] = await tx
      .insert(customers)
      .values({
        name: input.name,
        nameKana: input.nameKana ?? null,
        phoneE164: input.phone,
        phoneDisplay: rawPhone.normalize('NFKC').trim().slice(0, 32),
        occupation: input.occupation,
        locale: input.locale,
      })
      .onConflictDoUpdate({
        target: customers.phoneE164,
        targetWhere: sql`phone_e164 IS NOT NULL AND deleted_at IS NULL AND merged_into_customer_id IS NULL`,
        set: {
          name: sql`excluded.name`,
          nameKana: sql`excluded.name_kana`,
          occupation: sql`excluded.occupation`,
          locale: sql`excluded.locale`,
        },
      })
      .returning({ id: customers.id, restriction: customers.bookingRestriction })
    if (!customer) throw new Error('customer upsert returned no row')
    if (customer.restriction !== 'none') throw new Abort({ status: 'restricted' })

    const bookingId = randomUUID()
    const consentId = randomUUID()
    const token = issueCancelToken()
    const durationMin = menu.durationMin + menu.bufferAfterMin

    await tx.insert(bookings).values({
      id: bookingId,
      publicCode: generatePublicCode(),
      resourceId: RESOURCE_ID,
      customerId: customer.id,
      menuId: menu.id,
      // Half-open [start, start + duration + buffer): touching ranges never conflict.
      during: { start: startsAt, end: new Date(startsAt.getTime() + durationMin * 60_000) },
      status: 'confirmed',
      source: 'web',
      locale: input.locale,
      priceJpy: applicablePrice(menu, input.occupation),
      isStudent: input.occupation === 'student',
      bufferMin: menu.bufferAfterMin,
      note: input.note ?? null,
      idempotencyKey,
      submissionNonceHash: sha256(input.submissionNonce),
      cancelTokenHash: token.hash,
      cancelTokenExpiresAt: new Date(startsAt.getTime() - cancelDeadlineMin * 60_000),
      consentId,
    })

    // One checkbox records two consents (12.3). The FKs are DEFERRABLE (checked at COMMIT).
    const userAgent = ctx.userAgent?.slice(0, 512) ?? null
    await tx.insert(consents).values([
      { id: consentId, customerId: customer.id, bookingId, kind: 'booking_policy', policyVersion: POLICY_VERSION, ip: ctx.ip, userAgent },
      { customerId: customer.id, bookingId, kind: 'privacy', policyVersion: POLICY_VERSION, ip: ctx.ip, userAgent },
    ])

    await incrementPhoneDaily(input.phone, tx)
    await audit(tx, {
      actor: `customer:${bookingId}`,
      action: 'booking.create',
      entityType: 'booking',
      entityId: bookingId,
      diff: {
        menuId: menu.id,
        startsAt: startsAt.toISOString(),
        source: 'web',
        phone_tail: piiHmac(phoneTail(input.phone)),
      },
    })

    return { result: { status: 'ok', data: { doneUrl: doneUrl(input.locale, token.raw) } }, bookingId }
  })
}

/**
 * createBooking pipeline: Zod -> honeypot -> rate limits -> Turnstile -> transaction
 * (cheapest checks first; the external siteverify call and DB writes last, D-03).
 */
export async function submitBooking(raw: unknown, context: RequestContext): Promise<CreateBookingResult> {
  const ctx = { ...context, now: context.now ?? new Date() }

  // (1) Syntax / semantics
  const parsed = createBookingSchema.safeParse(raw)
  if (!parsed.success) return { result: invalid(parsed.error) }
  const input = parsed.data
  const rawPhone = String((raw as Record<string, unknown>).phone ?? '')

  // (2) Honeypot: pretend success, store nothing (FR-S-05)
  if (input.website !== '') {
    logger.info('booking.honeypot', {})
    return { result: { status: 'ok', data: { doneUrl: `/${input.locale}/book` } } }
  }

  // (3) Rate limits: IP counted on every attempt; phone checked here, counted on success
  const ipLimit = await hitWindow(rateKeys.bookingIp(ctx.ip), LIMITS.bookingIp.windowSec, LIMITS.bookingIp.limit)
  if (!ipLimit.ok) return { result: { status: 'rate_limited', retryAfterSec: ipLimit.retryAfterSec } }
  const phoneLimit = await checkPhoneDaily(input.phone)
  if (!phoneLimit.ok) return { result: { status: 'rate_limited', retryAfterSec: phoneLimit.retryAfterSec } }

  // (4) Turnstile (external I/O, after everything cheap)
  const human = await verifyTurnstile({ token: input.turnstileToken, ip: ctx.ip, idempotencyKey: input.submissionNonce })
  if (!human) return { result: { status: 'bot_check_failed' } }

  // (5) Transaction; retry once only for the (practically impossible) random-value collisions
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { result, bookingId } = await insertBooking(input, rawPhone, ctx)
      if (bookingId) logger.info('booking.created', { bookingId })
      return bookingId ? { result, createdBookingId: bookingId } : { result }
    } catch (err) {
      if (err instanceof Abort) return { result: err.result }
      if (isExclusionViolation(err, CONSTRAINTS.noOverlap)) {
        return { result: { status: 'conflict', reason: 'slot_taken' } }
      }
      if (isUniqueViolation(err, CONSTRAINTS.idempotencyActive)) {
        // A concurrent identical submission committed first: same browser gets it back.
        const resolved = await db.transaction(async (tx) => {
          const menuRow = await tx.select({ id: menus.id }).from(menus).where(eq(menus.slug, input.menuSlug)).limit(1)
          const menuId = menuRow[0]?.id
          if (!menuId) return null
          const key = idempotencyKeyOf(new Date(input.startsAt), menuId, input.phone)
          return resolveExistingByIdempotency(tx, key, input.submissionNonce, input.locale)
        })
        return { result: resolved ?? { status: 'conflict', reason: 'slot_taken' } }
      }
      if (
        attempt === 0 &&
        (isUniqueViolation(err, CONSTRAINTS.publicCode) || isUniqueViolation(err, CONSTRAINTS.cancelTokenHash))
      ) {
        continue
      }
      return { result: errorResult(err, 'booking.create_failed') }
    }
  }
  return { result: errorResult(new Error('retry exhausted'), 'booking.create_failed') }
}

export type CancelBookingResult = {
  result: ActionResult<null>
  cancelledBookingId?: string
}

/** Viewing window for token pages: until 24h after the booking ends (05 §3). */
export const VIEW_GRACE_MS = 24 * 60 * 60 * 1000

/**
 * Self-cancel by token (FR-C-12, FR-S-06): format check -> SHA-256 lookup under the lock ->
 * constant-time compare -> deadline check -> cancelled_by_customer, token invalidated.
 * "Not found" never reveals why (enumeration resistance).
 */
export async function cancelByToken(raw: unknown, context: Omit<RequestContext, 'ip' | 'userAgent'>): Promise<CancelBookingResult> {
  const now = context.now ?? new Date()
  const parsed = cancelBookingSchema.safeParse(raw)
  if (!parsed.success || !isCancelTokenFormat(parsed.data.token)) return { result: { status: 'not_found' } }
  const hash = hashCancelToken(parsed.data.token)

  try {
    return await db.transaction(async (tx) => {
      await lockCalendar(tx)
      const rows = await tx.execute<{
        id: string
        status: string
        cancel_token_hash: Buffer | null
        // drizzle's node-postgres session returns timestamptz as strings
        cancel_token_expires_at: string | null
        end_at: string
      }>(sql`
        SELECT id, status, cancel_token_hash, cancel_token_expires_at, upper(during) AS end_at
        FROM bookings WHERE cancel_token_hash = ${hash} AND deleted_at IS NULL
        FOR UPDATE
      `)
      const row = rows.rows[0]
      if (!row?.cancel_token_hash || !hashesEqual(row.cancel_token_hash, hash)) {
        return { result: { status: 'not_found' } }
      }
      if (row.status !== 'confirmed' || now.getTime() >= new Date(row.end_at).getTime() + VIEW_GRACE_MS) {
        return { result: { status: 'not_found' } }
      }
      if (!row.cancel_token_expires_at || now.getTime() >= new Date(row.cancel_token_expires_at).getTime()) {
        return { result: { status: 'past_deadline' } }
      }
      await tx
        .update(bookings)
        .set({
          status: 'cancelled_by_customer',
          cancelledAt: now,
          cancelTokenHash: null,
          acknowledgedAt: null,
          statusChangedAt: now,
        })
        .where(eq(bookings.id, row.id))
      await audit(tx, {
        actor: `customer:${row.id}`,
        action: 'booking.cancel',
        entityType: 'booking',
        entityId: row.id,
        diff: { from: 'confirmed', to: 'cancelled_by_customer' },
      })
      return { result: { status: 'ok', data: null }, cancelledBookingId: row.id }
    })
  } catch (err) {
    return { result: errorResult(err, 'booking.cancel_failed') }
  }
}
