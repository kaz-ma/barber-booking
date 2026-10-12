import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { POLICY_VERSION } from '@/config/shop'
import { ACTIVE_STATUSES } from '@/domain/booking-status'
import { phoneTail } from '@/domain/phone'
import { applicablePrice, isStudentRateApplied } from '@/domain/pricing'
import { jstDate } from '@/domain/time'
import type { ActionResult } from '@/lib/action-result'
import { invalid } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { db, type Tx } from '@/lib/db'
import { disableJit, queryAvailabilityDays } from '@/lib/db/availability-sql'
import { bookings, consents, customers, menus, settings } from '@/lib/db/schema'
import { piiHmac, sha256, sha256Hex } from '@/lib/hash'
import { logger } from '@/lib/logger'
import { CONSTRAINTS, isExclusionViolation, isUniqueViolation } from '@/lib/pg-errors'
import { checkPhoneDaily, hitWindow, incrementPhoneDaily, LIMITS, rateKeys } from '@/lib/rate-limit'
import { generatePublicCode, hashCancelToken, hashesEqual, isCancelTokenFormat, issueCancelToken } from '@/lib/tokens'
import { verifyTurnstile } from '@/lib/turnstile'
import { unexpectedError } from '@/lib/unexpected-error'
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

/** Unexpected errors: logged without the message (it may embed SQL parameters, CR-01). */
const errorResult = (err: unknown, event: string): ActionResult<never> => unexpectedError(err, event)

const SLOT_TAKEN = { status: 'conflict', reason: 'slot_taken' } as const

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
 * existing booking. Anyone else gets the same answer as for any taken slot (SR-12): telling
 * `duplicate` apart from `slot_taken` would reveal whether a given phone number holds that slot
 * (G-04, T-05). The internal reason is logged as `booking.duplicate_rejected` (no PII).
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
    logger.info('booking.duplicate_rejected', {})
    return SLOT_TAKEN
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
    await disableJit(tx)

    // Phone limit under the calendar lock (SR-02 / CR-08): every booking write is serialised by
    // the lock, so check + increment (below, same transaction) are atomic per phone.
    const phoneLimit = await checkPhoneDaily(input.phone, { db: tx, now: ctx.now })
    if (!phoneLimit.ok) throw new Abort({ status: 'rate_limited', retryAfterSec: phoneLimit.retryAfterSec })

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
    if (slot.status === 'full') throw new Abort(SLOT_TAKEN)

    const [conf] = await tx.select({ cancelDeadlineMin: settings.cancelDeadlineMin }).from(settings).limit(1)
    const cancelDeadlineMin = conf?.cancelDeadlineMin ?? 120

    // Customers are the single source of PII (ADR-0008): upsert by phone, never snapshot.
    // The previous values are read (locked) first so an overwrite can be audited (SR-14).
    const [previous] = await tx
      .select({ name: customers.name, nameKana: customers.nameKana })
      .from(customers)
      .where(
        and(
          eq(customers.phoneE164, input.phone),
          isNull(customers.deletedAt),
          isNull(customers.mergedIntoCustomerId),
        ),
      )
      .for('update')
      .limit(1)
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
          // /en has no furigana field: keep the stored kana instead of nulling it (CR-05).
          nameKana: sql`COALESCE(excluded.name_kana, ${customers.nameKana})`,
          occupation: sql`excluded.occupation`,
          locale: sql`excluded.locale`,
        },
      })
      .returning({ id: customers.id, restriction: customers.bookingRestriction })
    if (!customer) throw new Error('customer upsert returned no row')
    if (customer.restriction !== 'none') throw new Abort({ status: 'restricted' })
    if (previous) {
      // Column names only, never values (allow-listed diff, AGENTS.md rule 6).
      const changed = [
        previous.name !== input.name ? 'name' : null,
        input.nameKana && previous.nameKana !== input.nameKana ? 'nameKana' : null,
      ].filter((f): f is string => f !== null)
      if (changed.length > 0) {
        await audit(tx, {
          actor: 'system',
          action: 'customer.overwrite',
          entityType: 'customer',
          entityId: customer.id,
          diff: { fields: changed.join(','), source: 'web' },
        })
      }
    }

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
      // "Student price applied", not "occupation is student" (CR-06): a menu without a student
      // price charges the regular price and must not show the student tag.
      isStudent: isStudentRateApplied(menu, input.occupation),
      bufferMin: menu.bufferAfterMin,
      note: input.note ?? null,
      idempotencyKey,
      submissionNonceHash: sha256(input.submissionNonce),
      cancelTokenHash: token.hash,
      cancelTokenExpiresAt: new Date(startsAt.getTime() - cancelDeadlineMin * 60_000),
      consentId,
    })

    // One checkbox records two consents (12.3). The FKs are DEFERRABLE (checked at COMMIT).
    // The IP is stored as an HMAC like the rate-limit keys (AGENTS.md rule 5, SR-15).
    const userAgent = ctx.userAgent?.slice(0, 512) ?? null
    const ipHash = piiHmac(ctx.ip)
    await tx.insert(consents).values([
      {
        id: consentId,
        customerId: customer.id,
        bookingId,
        kind: 'booking_policy',
        policyVersion: POLICY_VERSION,
        ipHash,
        userAgent,
      },
      { customerId: customer.id, bookingId, kind: 'privacy', policyVersion: POLICY_VERSION, ipHash, userAgent },
    ])

    await incrementPhoneDaily(input.phone, { db: tx, now: ctx.now })
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

  // (2) Honeypot: pretend success, store nothing (FR-S-05). The fake done URL has the same
  // shape as a real one (an unstored random token) so bots cannot tell them apart (SR-24).
  if (input.website !== '') {
    logger.info('booking.honeypot', {})
    return { result: { status: 'ok', data: { doneUrl: doneUrl(input.locale, issueCancelToken().raw) } } }
  }

  // (3) Rate limits: IP counted on every attempt; phone checked here as an early rejection and
  // again under the lock inside the transaction, where it is counted on success (SR-02).
  const ipLimit = await hitWindow(rateKeys.bookingIp(ctx.ip), LIMITS.bookingIp.windowSec, LIMITS.bookingIp.limit, {
    now: ctx.now,
  })
  if (!ipLimit.ok) return { result: { status: 'rate_limited', retryAfterSec: ipLimit.retryAfterSec } }
  const phoneLimit = await checkPhoneDaily(input.phone, { now: ctx.now })
  if (!phoneLimit.ok) return { result: { status: 'rate_limited', retryAfterSec: phoneLimit.retryAfterSec } }

  // (4) Turnstile (external I/O, after everything cheap). The token is bound to the nonce (SR-03).
  const human = await verifyTurnstile({ token: input.turnstileToken, ip: ctx.ip, nonce: input.submissionNonce })
  if (!human) return { result: { status: 'bot_check_failed' } }

  // (5) Transaction; retry once only for the (practically impossible) random-value collisions
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { result, bookingId } = await insertBooking(input, rawPhone, ctx)
      if (bookingId) logger.info('booking.created', { bookingId })
      return bookingId ? { result, createdBookingId: bookingId } : { result }
    } catch (err) {
      if (err instanceof Abort) return { result: err.result }
      if (isExclusionViolation(err, CONSTRAINTS.noOverlap)) return { result: SLOT_TAKEN }
      if (isUniqueViolation(err, CONSTRAINTS.idempotencyActive)) {
        // A concurrent identical submission committed first: same browser gets it back.
        const resolved = await db.transaction(async (tx) => {
          const menuRow = await tx.select({ id: menus.id }).from(menus).where(eq(menus.slug, input.menuSlug)).limit(1)
          const menuId = menuRow[0]?.id
          if (!menuId) return null
          const key = idempotencyKeyOf(new Date(input.startsAt), menuId, input.phone)
          return resolveExistingByIdempotency(tx, key, input.submissionNonce, input.locale)
        })
        return { result: resolved ?? SLOT_TAKEN }
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
  /** `alreadyCancelled`: the same link was used again after a successful cancel (CR-09). */
  result: ActionResult<{ alreadyCancelled: boolean }>
  cancelledBookingId?: string
}

/** Viewing window for token pages: until 24h after the booking ends (05 §3). */
export const VIEW_GRACE_MS = 24 * 60 * 60 * 1000

/**
 * Self-cancel by token (FR-C-12, FR-S-06):
 *   IP rate limit (SR-01: here, not only in proxy.ts — a Server Action can be posted to any URL)
 *   -> format check -> lock-free existence check by SHA-256 (an unknown token never takes the
 *   calendar lock or holds a connection in a transaction) -> lock -> re-read FOR UPDATE ->
 *   constant-time compare -> deadline -> cancelled_by_customer.
 * "Not found" never reveals why (enumeration resistance).
 *
 * Idempotent (CR-09): the hash stays on a customer-cancelled row, so a double tap / resubmission
 * of the same link answers `ok` with `alreadyCancelled: true` instead of "not found". The token
 * can do nothing else: token pages and the ICS only resolve `confirmed` bookings.
 */
export async function cancelByToken(
  raw: unknown,
  context: { ip: string; now?: Date },
): Promise<CancelBookingResult> {
  const now = context.now ?? new Date()
  try {
    const rate = await hitWindow(rateKeys.cancelIp(context.ip), LIMITS.cancelIp.windowSec, LIMITS.cancelIp.limit, {
      now,
    })
    if (!rate.ok) return { result: { status: 'rate_limited', retryAfterSec: rate.retryAfterSec } }

    const parsed = cancelBookingSchema.safeParse(raw)
    if (!parsed.success || !isCancelTokenFormat(parsed.data.token)) return { result: { status: 'not_found' } }
    const hash = hashCancelToken(parsed.data.token)

    const exists = await db.execute<{ id: string }>(sql`
      SELECT id FROM bookings WHERE cancel_token_hash = ${hash} AND deleted_at IS NULL
    `)
    if (exists.rows.length === 0) return { result: { status: 'not_found' } }

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
      const viewable = now.getTime() < new Date(row.end_at).getTime() + VIEW_GRACE_MS
      if (row.status === 'cancelled_by_customer' && viewable) {
        return { result: { status: 'ok', data: { alreadyCancelled: true } } }
      }
      if (row.status !== 'confirmed' || !viewable) return { result: { status: 'not_found' } }
      if (!row.cancel_token_expires_at || now.getTime() >= new Date(row.cancel_token_expires_at).getTime()) {
        return { result: { status: 'past_deadline' } }
      }
      await tx
        .update(bookings)
        .set({
          status: 'cancelled_by_customer',
          cancelledAt: now,
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
      return { result: { status: 'ok', data: { alreadyCancelled: false } }, cancelledBookingId: row.id }
    })
  } catch (err) {
    return { result: errorResult(err, 'booking.cancel_failed') }
  }
}
