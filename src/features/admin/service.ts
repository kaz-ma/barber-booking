import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { type BookingStatus, canTransition, stepBackTarget } from '@/domain/booking-status'
import { floorToMinutes, jstInstant, minutesFromJstMidnight } from '@/domain/jst-format'
import { phoneTail } from '@/domain/phone'
import { jstDate, toJstIso } from '@/domain/time'
import type { ActionResult } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { auth } from '@/lib/auth'
import { db, type Tx } from '@/lib/db'
import {
  authSession,
  authUser,
  bookings,
  businessHourOverrides,
  businessHours,
  consents,
  customers,
  menus,
  pushSubscriptions,
  settings,
  timeBlocks,
} from '@/lib/db/schema'
import { env } from '@/lib/env'
import { piiHmac } from '@/lib/hash'
import { logger } from '@/lib/logger'
import { countUnacknowledged, UNACKNOWLEDGED_WHERE } from '@/lib/notify'
import { CONSTRAINTS, errorFields, isExclusionViolation, isUniqueViolation } from '@/lib/pg-errors'
import { type PushSendResult, sendPushToAll } from '@/lib/push'
import { buildDeclarativePayload } from '@/lib/push-payload'
import { hitWindow } from '@/lib/rate-limit'
import { absoluteUrl } from '@/lib/site'
import { generatePublicCode, issueCancelToken } from '@/lib/tokens'
import { type UnexpectedResult, unexpectedError } from '@/lib/unexpected-error'
import { findOverlaps, hoursForDate, lockCalendar, RESOURCE_ID } from './calendar'
import type { CreateManualBookingInput, CreateTimeBlockInput, UpsertMenuInput } from './schema'
import { safeAdminNext } from './schema'
import type { AdminResult, ManualBookingWarning, OverlapDTO } from './types'
import { signUndo, UNDO_WINDOW_MS, verifyUndo } from './undo'

/*
 * Admin service (06_api.md §3, 05_state_and_flows.md §1, §4). actions.ts runs requireAdmin()
 * and Zod first, then calls these with an injectable clock so the logic is testable against a
 * real Postgres without a Next.js request. Expected failures are returned as values; only
 * unexpected errors are logged (digest) — never with names, phones or notes.
 */

export type AdminCtx = { now?: Date }

class Abort<T> extends Error {
  constructor(readonly result: AdminResult<T>) {
    super(result.status)
  }
}

/** Unexpected errors: logged without the message (it may embed SQL parameters, CR-01). */
const errorResult = (err: unknown, event: string): UnexpectedResult => unexpectedError(err, event)

function fieldError(field: string, key: string): { status: 'invalid'; fieldErrors: Record<string, string[]> } {
  return { status: 'invalid', fieldErrors: { [field]: [key] } }
}

async function cancelDeadlineMin(tx: Tx): Promise<number> {
  const [s] = await tx.select({ v: settings.cancelDeadlineMin }).from(settings).limit(1)
  return s?.v ?? 120
}

async function leadTimeMin(tx: Tx): Promise<number> {
  const [s] = await tx.select({ v: settings.leadTimeMin }).from(settings).limit(1)
  return s?.v ?? 60
}

const confirmPath = (locale: 'ja' | 'en', raw: string) => `/${locale}/book/done/${raw}` as const

// ------------------------------------------------------------------ manual booking (S-A-05)

export type ManualBookingOk = {
  bookingId: string
  confirmUrl: string
  warnings: ManualBookingWarning[]
}

/**
 * createManualBooking (FR-A-05, OI-11): no override — an overlap with an active booking is
 * never saved. Checked under the lock before INSERT, and the EXCLUDE constraint (23P01) is the
 * last line of defence. Overlapping a block or the outside of opening hours only warns.
 */
export async function createManualBooking(
  input: CreateManualBookingInput,
  ctx: AdminCtx = {},
): Promise<AdminResult<ManualBookingOk>> {
  const now = ctx.now ?? new Date()
  const startsAt = new Date(input.startsAt)
  for (let attempt = 0; attempt < 2; attempt++) {
    let endsAt: Date | null = null
    try {
      return await db.transaction(async (tx) => {
        await lockCalendar(tx)
        const [menu] = await tx.select().from(menus).where(eq(menus.id, input.menuId)).limit(1)
        if (!menu) throw new Abort<ManualBookingOk>(fieldError('menuId', 'menuRequired'))
        endsAt = new Date(startsAt.getTime() + (menu.durationMin + menu.bufferAfterMin) * 60_000)

        const overlaps = await findOverlaps(tx, startsAt, endsAt, { includeBlocks: false })
        if (overlaps.length > 0) throw new Abort<ManualBookingOk>({ status: 'conflict', reason: 'overlap', overlaps })

        const customerId = await resolveCustomer(tx, input)
        if (!customerId) throw new Abort<ManualBookingOk>(fieldError('customerId', 'customerNotFound'))

        const warnings: ManualBookingWarning[] = []
        const blocks = await findOverlaps(tx, startsAt, endsAt, { includeBlocks: true })
        if (blocks.some((o) => o.kind === 'block')) warnings.push('block_overlap')
        const date = jstDate(startsAt)
        const hours = await hoursForDate(tx, date)
        const s = minutesFromJstMidnight(startsAt, date)
        const e = minutesFromJstMidnight(endsAt, date)
        if (
          hours.isClosed ||
          hours.openMin === null ||
          hours.closeMin === null ||
          s < hours.openMin ||
          e > hours.closeMin
        ) {
          warnings.push('outside_hours')
        }

        const bookingId = randomUUID()
        const token = issueCancelToken()
        const deadline = await cancelDeadlineMin(tx)
        await tx.insert(bookings).values({
          id: bookingId,
          publicCode: generatePublicCode(),
          resourceId: RESOURCE_ID,
          customerId,
          menuId: menu.id,
          during: { start: startsAt, end: endsAt },
          status: 'confirmed',
          source: input.source,
          locale: input.linkLocale,
          priceJpy: menu.priceJpy,
          bufferMin: menu.bufferAfterMin,
          ownerNote: input.ownerNote ?? null,
          cancelTokenHash: token.hash,
          cancelTokenExpiresAt: new Date(startsAt.getTime() - deadline * 60_000),
          // Entered by the owner: never shows up as unread (05 §1.1).
          acknowledgedAt: now,
          statusChangedAt: now,
        })
        await audit(tx, {
          actor: 'owner',
          action: 'booking.create',
          entityType: 'booking',
          entityId: bookingId,
          diff: { menuId: menu.id, startsAt: startsAt.toISOString(), source: input.source },
        })
        return {
          status: 'ok',
          data: { bookingId, confirmUrl: absoluteUrl(confirmPath(input.linkLocale, token.raw)), warnings },
        }
      })
    } catch (err) {
      if (err instanceof Abort) return err.result as AdminResult<ManualBookingOk>
      if (isExclusionViolation(err, CONSTRAINTS.noOverlap)) {
        const overlaps = endsAt ? await findOverlaps(db, startsAt, endsAt, { includeBlocks: false }) : []
        return { status: 'conflict', reason: 'overlap', overlaps }
      }
      if (
        attempt === 0 &&
        (isUniqueViolation(err, CONSTRAINTS.publicCode) || isUniqueViolation(err, CONSTRAINTS.cancelTokenHash))
      ) {
        continue
      }
      return errorResult(err, 'admin.manual_booking_failed')
    }
  }
  return errorResult(new Error('retry exhausted'), 'admin.manual_booking_failed')
}

/** Link the chosen / phone-matching customer, or create one (phone_unverified = true). */
async function resolveCustomer(tx: Tx, input: CreateManualBookingInput): Promise<string | null> {
  if (input.customerId) {
    const [c] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, input.customerId), isNull(customers.anonymizedAt), isNull(customers.deletedAt)))
      .limit(1)
    return c?.id ?? null
  }
  if (input.phone) {
    const [existing] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.phoneE164, input.phone), isNull(customers.deletedAt), isNull(customers.mergedIntoCustomerId)),
      )
      .limit(1)
    if (existing) return existing.id
  }
  const [created] = await tx
    .insert(customers)
    .values({
      name: input.name,
      nameKana: input.nameKana ?? null,
      phoneE164: input.phone ?? null,
      phoneDisplay: input.phone ?? null,
      phoneUnverified: Boolean(input.phone),
    })
    .returning({ id: customers.id })
  return created?.id ?? null
}

// ------------------------------------------------------------------ status changes (S-A-04)

const UNDOABLE: readonly BookingStatus[] = ['cancelled_by_owner', 'cancelled_late', 'no_show']

/** customers.last_visit_at from the customer's remaining completed bookings. */
async function recomputeLastVisit(tx: Tx, customerId: string): Promise<void> {
  await tx.execute(sql`
    UPDATE customers SET last_visit_at = (
      SELECT max(upper(b.during)) FROM bookings b WHERE b.customer_id = ${customerId} AND b.status = 'completed')
    WHERE id = ${customerId}`)
}
const CANCELLED: readonly BookingStatus[] = ['cancelled_by_customer', 'cancelled_by_owner', 'cancelled_late']

export type StatusChangeOk = { status: BookingStatus; undoToken?: string; expiresAt?: string }

type LockedBooking = {
  id: string
  status: BookingStatus
  customer_id: string
  cancel_token_hash: Buffer | null
  end_at: string
}

async function lockBooking(tx: Tx, bookingId: string): Promise<LockedBooking | null> {
  const res = await tx.execute<LockedBooking>(sql`
    SELECT id, status, customer_id, cancel_token_hash, upper(during) AS end_at
    FROM bookings WHERE id = ${bookingId} AND deleted_at IS NULL FOR UPDATE
  `)
  return res.rows[0] ?? null
}

/** updateBookingStatus (FR-A-04): owner transitions of the 6.3 state machine. */
export async function updateBookingStatus(
  input: { bookingId: string; to: BookingStatus; lateMinutes?: number; reason?: string },
  ctx: AdminCtx = {},
): Promise<ActionResult<StatusChangeOk>> {
  const now = ctx.now ?? new Date()
  try {
    return await db.transaction(async (tx) => {
      await lockCalendar(tx)
      const row = await lockBooking(tx, input.bookingId)
      if (!row) return { status: 'not_found' }
      const from = row.status
      // Back to `confirmed` only through undoBookingChange (signed, 10 s).
      if (input.to === 'confirmed' || !canTransition(from, input.to, 'owner')) {
        return fieldError('to', 'transitionInvalid')
      }
      const isCancel = CANCELLED.includes(input.to)
      await tx
        .update(bookings)
        .set({
          status: input.to,
          statusChangedAt: now,
          ...(isCancel
            ? { cancelledAt: now, cancelTokenHash: null, cancelReason: input.reason?.slice(0, 200) ?? null }
            : {}),
          ...(input.to === 'arrived' && input.lateMinutes !== undefined ? { lateMinutes: input.lateMinutes } : {}),
        })
        .where(eq(bookings.id, row.id))
      if (input.to === 'cancelled_late') {
        await tx
          .update(customers)
          .set({ lateCancelCount: sql`${customers.lateCancelCount} + 1` })
          .where(eq(customers.id, row.customer_id))
      }
      if (input.to === 'no_show') {
        await tx
          .update(customers)
          .set({ noShowCount: sql`${customers.noShowCount} + 1` })
          .where(eq(customers.id, row.customer_id))
        if (from === 'completed') await recomputeLastVisit(tx, row.customer_id)
      }
      if (input.to === 'completed') {
        await tx
          .update(customers)
          .set({
            lastVisitAt: sql`GREATEST(coalesce(${customers.lastVisitAt}, ${row.end_at}::timestamptz), ${row.end_at}::timestamptz)`,
          })
          .where(eq(customers.id, row.customer_id))
      }
      await audit(tx, {
        actor: 'owner',
        action: 'booking.status',
        entityType: 'booking',
        entityId: row.id,
        diff: { from, to: input.to },
      })
      if (!UNDOABLE.includes(input.to)) return { status: 'ok', data: { status: input.to } }
      const exp = now.getTime() + UNDO_WINDOW_MS
      const undoToken = signUndo({
        b: row.id,
        prev: from,
        next: input.to,
        exp,
        ...(row.cancel_token_hash ? { h: row.cancel_token_hash.toString('base64url') } : {}),
      })
      return { status: 'ok', data: { status: input.to, undoToken, expiresAt: new Date(exp).toISOString() } }
    })
  } catch (err) {
    return errorResult(err, 'admin.status_failed')
  }
}

/**
 * autoAdvanceBookings (B2, 2026-10-18): the owner no longer taps 来店 / 施術開始 / 終了 for every
 * booking. A booking whose start has passed becomes 施術中 and one whose (display) end has
 * passed becomes 終了, with the same side effect as tapping 終了 (customers.last_visit_at).
 * Exceptions are recorded by hand: 無断 from 施術中 / 終了, or 1 つ前に戻す; a booking the owner
 * stepped back after its start (or end) is not moved again. Runs when the admin
 * app opens a day or a booking and from the nightly cron; only bookings that ended within the
 * last 30 days are touched. Never touches cancelled, deleted or future bookings.
 */
export async function autoAdvanceBookings(ctx: AdminCtx = {}): Promise<{ started: number; completed: number }> {
  const now = (ctx.now ?? new Date()).toISOString()
  return db.transaction(async (tx) => {
    const done = await tx.execute<{ id: string; customer_id: string; prev: string; end_at: string }>(sql`
      WITH due AS (
        SELECT id, customer_id, status AS prev, upper(during) - make_interval(mins => buffer_min) AS end_at
        FROM bookings
        WHERE deleted_at IS NULL
          AND upper(during) - make_interval(mins => buffer_min) <= ${now}::timestamptz
          AND upper(during) > ${now}::timestamptz - interval '30 days'
          -- Left alone once the owner has stepped it back by hand (after its start / end).
          AND (
            (status = 'in_progress' AND status_changed_at < upper(during) - make_interval(mins => buffer_min))
            OR (status IN ('confirmed', 'arrived') AND status_changed_at < lower(during))
          )
        FOR UPDATE
      )
      UPDATE bookings b SET status = 'completed', status_changed_at = ${now}::timestamptz, updated_at = ${now}::timestamptz
      FROM due WHERE b.id = due.id
      RETURNING due.id, due.customer_id, due.prev, due.end_at`)
    for (const r of done.rows) {
      await tx
        .update(customers)
        .set({
          lastVisitAt: sql`GREATEST(coalesce(${customers.lastVisitAt}, ${r.end_at}::timestamptz), ${r.end_at}::timestamptz)`,
        })
        .where(eq(customers.id, r.customer_id))
      await audit(tx, {
        actor: 'system',
        action: 'booking.auto_status',
        entityType: 'booking',
        entityId: r.id,
        diff: { from: r.prev, to: 'completed' },
      })
    }
    const started = await tx.execute<{ id: string; prev: string }>(sql`
      WITH due AS (
        SELECT id, status AS prev FROM bookings
        WHERE deleted_at IS NULL AND status IN ('confirmed', 'arrived')
          AND lower(during) <= ${now}::timestamptz
          AND upper(during) - make_interval(mins => buffer_min) > ${now}::timestamptz
          AND status_changed_at < lower(during)
        FOR UPDATE
      )
      UPDATE bookings b SET status = 'in_progress', status_changed_at = ${now}::timestamptz, updated_at = ${now}::timestamptz
      FROM due WHERE b.id = due.id
      RETURNING due.id, due.prev`)
    for (const r of started.rows) {
      await audit(tx, {
        actor: 'system',
        action: 'booking.auto_status',
        entityType: 'booking',
        entityId: r.id,
        diff: { from: r.prev, to: 'in_progress' },
      })
    }
    return { started: started.rows.length, completed: done.rows.length }
  })
}

/** autoAdvanceBookings for page renders: a failure is logged and never breaks the page. */
export async function settleBookingStatuses(now: Date = new Date()): Promise<void> {
  try {
    await autoAdvanceBookings({ now })
  } catch (err) {
    logger.error('admin.auto_status_failed', errorFields(err))
  }
}

/**
 * stepBackBookingStatus (CR-24): arrived -> confirmed, in_progress -> arrived,
 * completed -> in_progress. Undoes the side effects of the forward step: late minutes are
 * cleared, and customers.last_visit_at is recomputed from the remaining completed bookings.
 * Going back to an active status re-enters the EXCLUDE constraint; if the slot was re-booked
 * meanwhile the result is `conflict: undo_blocked`.
 */
export async function stepBackBookingStatus(
  bookingId: string,
  ctx: AdminCtx = {},
): Promise<ActionResult<StatusChangeOk>> {
  const now = ctx.now ?? new Date()
  try {
    return await db.transaction(async (tx) => {
      await lockCalendar(tx)
      const row = await lockBooking(tx, bookingId)
      if (!row) return { status: 'not_found' }
      const to = stepBackTarget(row.status)
      if (!to) return fieldError('to', 'transitionInvalid')
      await tx
        .update(bookings)
        .set({ status: to, statusChangedAt: now, ...(to === 'confirmed' ? { lateMinutes: null } : {}) })
        .where(eq(bookings.id, row.id))
      if (row.status === 'completed') await recomputeLastVisit(tx, row.customer_id)
      await audit(tx, {
        actor: 'owner',
        action: 'booking.step_back',
        entityType: 'booking',
        entityId: row.id,
        diff: { from: row.status, to },
      })
      return { status: 'ok', data: { status: to } }
    })
  } catch (err) {
    if (isExclusionViolation(err, CONSTRAINTS.noOverlap)) return { status: 'conflict', reason: 'undo_blocked' }
    return errorResult(err, 'admin.step_back_failed')
  }
}

/** deleteBooking: mis-entry removal = cancelled_by_owner + soft delete, undoable. */
export async function deleteBooking(bookingId: string, ctx: AdminCtx = {}): Promise<ActionResult<StatusChangeOk>> {
  const now = ctx.now ?? new Date()
  try {
    return await db.transaction(async (tx) => {
      await lockCalendar(tx)
      const row = await lockBooking(tx, bookingId)
      if (!row) return { status: 'not_found' }
      if (row.status !== 'confirmed') return fieldError('to', 'transitionInvalid')
      await tx
        .update(bookings)
        .set({
          status: 'cancelled_by_owner',
          cancelledAt: now,
          cancelReason: 'deleted',
          cancelTokenHash: null,
          deletedAt: now,
          statusChangedAt: now,
        })
        .where(eq(bookings.id, row.id))
      await audit(tx, {
        actor: 'owner',
        action: 'booking.delete',
        entityType: 'booking',
        entityId: row.id,
        diff: { from: row.status, to: 'cancelled_by_owner' },
      })
      const exp = now.getTime() + UNDO_WINDOW_MS
      const undoToken = signUndo({
        b: row.id,
        prev: row.status,
        next: 'cancelled_by_owner',
        exp,
        d: 1,
        ...(row.cancel_token_hash ? { h: row.cancel_token_hash.toString('base64url') } : {}),
      })
      return {
        status: 'ok',
        data: { status: 'cancelled_by_owner', undoToken, expiresAt: new Date(exp).toISOString() },
      }
    })
  } catch (err) {
    return errorResult(err, 'admin.delete_failed')
  }
}

/** undoBookingChange: restore within the window; 23P01 means the slot was taken meanwhile. */
export async function undoBookingChange(undoToken: string, ctx: AdminCtx = {}): Promise<ActionResult<null>> {
  const now = ctx.now ?? new Date()
  const p = verifyUndo(undoToken, now)
  if (!p) return fieldError('undoToken', 'undoExpired')
  try {
    return await db.transaction(async (tx) => {
      await lockCalendar(tx)
      const res = await tx.execute<{ id: string; status: string; customer_id: string }>(sql`
        SELECT id, status, customer_id FROM bookings WHERE id = ${p.b} FOR UPDATE
      `)
      const row = res.rows[0]
      if (!row || row.status !== p.next) return fieldError('undoToken', 'undoExpired')
      await tx
        .update(bookings)
        .set({
          status: p.prev as BookingStatus,
          cancelledAt: null,
          cancelReason: null,
          deletedAt: null,
          cancelTokenHash: p.h ? Buffer.from(p.h, 'base64url') : null,
          statusChangedAt: now,
        })
        .where(eq(bookings.id, row.id))
      if (p.next === 'cancelled_late') {
        await tx
          .update(customers)
          .set({ lateCancelCount: sql`GREATEST(${customers.lateCancelCount} - 1, 0)` })
          .where(eq(customers.id, row.customer_id))
      }
      if (p.next === 'no_show') {
        await tx
          .update(customers)
          .set({ noShowCount: sql`GREATEST(${customers.noShowCount} - 1, 0)` })
          .where(eq(customers.id, row.customer_id))
      }
      if (p.prev === 'completed') await recomputeLastVisit(tx, row.customer_id)
      await audit(tx, {
        actor: 'owner',
        action: 'booking.undo',
        entityType: 'booking',
        entityId: row.id,
        diff: { from: p.next, to: p.prev },
      })
      return { status: 'ok', data: null }
    })
  } catch (err) {
    if (isExclusionViolation(err, CONSTRAINTS.noOverlap)) return { status: 'conflict', reason: 'undo_blocked' }
    return errorResult(err, 'admin.undo_failed')
  }
}

export async function updateOwnerNote(bookingId: string, ownerNote: string): Promise<ActionResult<null>> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(bookings)
      .set({ ownerNote: ownerNote.trim() === '' ? null : ownerNote })
      .where(eq(bookings.id, bookingId))
      .returning({ id: bookings.id })
    if (updated.length === 0) return { status: 'not_found' }
    // The note text itself is never written to audit_log (§9).
    await audit(tx, { actor: 'owner', action: 'booking.owner_note', entityType: 'booking', entityId: bookingId })
    return { status: 'ok', data: null }
  })
}

/** reissueConfirmationUrl: a new token (the old link stops working). Raw tokens are never stored. */
export async function reissueConfirmationUrl(
  input: { bookingId: string; linkLocale: 'ja' | 'en' },
  ctx: AdminCtx = {},
): Promise<ActionResult<{ confirmUrl: string }>> {
  const now = ctx.now ?? new Date()
  return db.transaction(async (tx) => {
    const res = await tx.execute<{ id: string; status: string; start_at: string; end_at: string }>(sql`
      SELECT id, status, lower(during) AS start_at, upper(during) AS end_at
      FROM bookings WHERE id = ${input.bookingId} AND deleted_at IS NULL FOR UPDATE
    `)
    const row = res.rows[0]
    if (!row) return { status: 'not_found' }
    if (row.status !== 'confirmed' || new Date(row.end_at).getTime() + 24 * 3600_000 <= now.getTime()) {
      return fieldError('bookingId', 'notReissuable')
    }
    const token = issueCancelToken()
    const deadline = await cancelDeadlineMin(tx)
    await tx
      .update(bookings)
      .set({
        cancelTokenHash: token.hash,
        cancelTokenExpiresAt: new Date(new Date(row.start_at).getTime() - deadline * 60_000),
      })
      .where(eq(bookings.id, row.id))
    await audit(tx, { actor: 'owner', action: 'booking.reissue_token', entityType: 'booking', entityId: row.id })
    return { status: 'ok', data: { confirmUrl: absoluteUrl(confirmPath(input.linkLocale, token.raw)) } }
  })
}

// ------------------------------------------------------------------ inbox (FR-A-11)

export async function acknowledgeBooking(
  bookingId: string,
  ctx: AdminCtx = {},
): Promise<ActionResult<{ unacknowledged: number }>> {
  const now = ctx.now ?? new Date()
  const updated = await db
    .update(bookings)
    .set({ acknowledgedAt: sql`coalesce(${bookings.acknowledgedAt}, ${now.toISOString()}::timestamptz)` })
    .where(eq(bookings.id, bookingId))
    .returning({ id: bookings.id })
  if (updated.length === 0) return { status: 'not_found' }
  return { status: 'ok', data: { unacknowledged: await countUnacknowledged() } }
}

export async function acknowledgeAll(
  ctx: AdminCtx = {},
): Promise<ActionResult<{ ids: string[]; unacknowledged: number }>> {
  const now = ctx.now ?? new Date()
  const res = await db.execute<{ id: string }>(sql`
    UPDATE bookings SET acknowledged_at = ${now.toISOString()}::timestamptz
    WHERE ${UNACKNOWLEDGED_WHERE} RETURNING id
  `)
  return { status: 'ok', data: { ids: res.rows.map((r) => r.id), unacknowledged: await countUnacknowledged() } }
}

/** Undo for "すべて確認済みにする" (06_inbox_empty comp). */
export async function unacknowledge(ids: string[]): Promise<ActionResult<{ unacknowledged: number }>> {
  if (ids.length > 0) {
    await db.update(bookings).set({ acknowledgedAt: null }).where(inArray(bookings.id, ids))
  }
  return { status: 'ok', data: { unacknowledged: await countUnacknowledged() } }
}

// ------------------------------------------------------------------ time blocks (S-A-06)

export type TimeBlockOk = { blockId: string; start: string; end: string; publicImpactUntil: string | null }

/** Preset ranges (03 §8.2): start = now floored to 5 min; untilClose ends at today's closing. */
export async function presetRange(
  preset: 'now60' | 'now120' | 'untilClose',
  now: Date,
): Promise<{ start: Date; end: Date } | null> {
  const start = floorToMinutes(now, 5)
  if (preset === 'now60') return { start, end: new Date(start.getTime() + 60 * 60_000) }
  if (preset === 'now120') return { start, end: new Date(start.getTime() + 120 * 60_000) }
  const today = jstDate(now)
  const hours = await hoursForDate(db, today)
  if (hours.isClosed || hours.closeMin === null) return null
  const end = jstInstant(today, hours.closeMin)
  return end.getTime() > start.getTime() ? { start, end } : null
}

export async function createTimeBlock(
  input: CreateTimeBlockInput,
  ctx: AdminCtx = {},
): Promise<AdminResult<TimeBlockOk>> {
  const now = ctx.now ?? new Date()
  let range: { start: Date; end: Date } | null
  if (input.preset) range = await presetRange(input.preset, now)
  else range = input.start && input.end ? { start: new Date(input.start), end: new Date(input.end) } : null
  if (!range) return fieldError('preset', input.preset ? 'afterClose' : 'rangeRequired')
  const { start, end } = range
  try {
    return await db.transaction(async (tx) => {
      await lockCalendar(tx)
      // A block never cancels bookings; overlapping active bookings need an explicit "それでもブロック".
      const overlaps = await findOverlaps(tx, start, end, { includeBlocks: false })
      if (overlaps.length > 0 && !input.force) {
        throw new Abort<TimeBlockOk>({ status: 'conflict', reason: 'overlap', overlaps })
      }
      const [block] = await tx
        .insert(timeBlocks)
        .values({ resourceId: RESOURCE_ID, during: { start, end }, kind: input.kind, label: input.label ?? null })
        .returning({ id: timeBlocks.id })
      if (!block) throw new Error('time block insert returned no row')
      await audit(tx, {
        actor: 'owner',
        action: 'time_block.create',
        entityType: 'time_block',
        entityId: block.id,
        diff: {
          start: start.toISOString(),
          end: end.toISOString(),
          kind: input.kind,
          preset: input.preset ?? null,
          overlapsBookings: overlaps.length,
        },
      })
      const lead = await leadTimeMin(tx)
      // Customer-visible effect: only slots starting after now + lead time can change.
      const firstBookable = now.getTime() + lead * 60_000
      const publicImpactUntil = end.getTime() > firstBookable ? toJstIso(end) : null
      return {
        status: 'ok',
        data: { blockId: block.id, start: toJstIso(start), end: toJstIso(end), publicImpactUntil },
      }
    })
  } catch (err) {
    if (err instanceof Abort) return err.result as AdminResult<TimeBlockOk>
    return errorResult(err, 'admin.block_failed')
  }
}

export async function deleteTimeBlock(blockId: string, ctx: AdminCtx = {}): Promise<ActionResult<null>> {
  const now = ctx.now ?? new Date()
  return db.transaction(async (tx) => {
    await lockCalendar(tx)
    const updated = await tx
      .update(timeBlocks)
      .set({ deletedAt: now })
      .where(and(eq(timeBlocks.id, blockId), isNull(timeBlocks.deletedAt)))
      .returning({ id: timeBlocks.id })
    if (updated.length === 0) return { status: 'not_found' }
    await audit(tx, { actor: 'owner', action: 'time_block.delete', entityType: 'time_block', entityId: blockId })
    return { status: 'ok', data: null }
  })
}

/** restoreTimeBlock: only within 10 s of the deletion (05 §1.1 undo window). */
export async function restoreTimeBlock(blockId: string, ctx: AdminCtx = {}): Promise<ActionResult<null>> {
  const now = ctx.now ?? new Date()
  return db.transaction(async (tx) => {
    await lockCalendar(tx)
    const updated = await tx
      .update(timeBlocks)
      .set({ deletedAt: null })
      .where(and(eq(timeBlocks.id, blockId), gt(timeBlocks.deletedAt, new Date(now.getTime() - UNDO_WINDOW_MS))))
      .returning({ id: timeBlocks.id })
    if (updated.length === 0) return fieldError('blockId', 'undoExpired')
    await audit(tx, { actor: 'owner', action: 'time_block.restore', entityType: 'time_block', entityId: blockId })
    return { status: 'ok', data: null }
  })
}

// ------------------------------------------------------------------ hours / settings / menus

export async function updateBusinessHours(
  days: {
    weekday: number
    isClosed: boolean
    openMin?: number
    closeMin?: number
  }[],
): Promise<ActionResult<null>> {
  await db.transaction(async (tx) => {
    for (const d of days) {
      const values = {
        weekday: d.weekday,
        isClosed: d.isClosed,
        openMin: d.isClosed ? null : (d.openMin ?? null),
        closeMin: d.isClosed ? null : (d.closeMin ?? null),
        updatedAt: new Date(),
      }
      await tx.insert(businessHours).values(values).onConflictDoUpdate({ target: businessHours.weekday, set: values })
    }
    await audit(tx, {
      actor: 'owner',
      action: 'business_hours.update',
      entityType: 'business_hours',
      entityId: 'week',
      diff: {
        closedDays: days
          .filter((d) => d.isClosed)
          .map((d) => d.weekday)
          .join(','),
      },
    })
  })
  return { status: 'ok', data: null }
}

export async function upsertHourOverride(input: {
  date: string
  isClosed: boolean
  openMin?: number
  closeMin?: number
  reason?: string
}): Promise<ActionResult<{ warnings: { bookingsOnDate: number } }>> {
  return db.transaction(async (tx) => {
    const values = {
      date: input.date,
      isClosed: input.isClosed,
      openMin: input.isClosed ? null : (input.openMin ?? null),
      closeMin: input.isClosed ? null : (input.closeMin ?? null),
      reason: input.reason ?? null,
    }
    await tx
      .insert(businessHourOverrides)
      .values(values)
      .onConflictDoUpdate({ target: businessHourOverrides.date, set: { ...values, updatedAt: new Date() } })
    const res = await tx.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM bookings
      WHERE status IN ('confirmed', 'arrived', 'in_progress')
        AND (lower(during) AT TIME ZONE 'Asia/Tokyo')::date = ${input.date}::date
    `)
    await audit(tx, {
      actor: 'owner',
      action: 'override.upsert',
      entityType: 'override',
      entityId: input.date,
      diff: { isClosed: input.isClosed, openMin: values.openMin, closeMin: values.closeMin },
    })
    // Existing bookings are never auto-cancelled; the owner is told how many remain.
    return { status: 'ok', data: { warnings: { bookingsOnDate: res.rows[0]?.n ?? 0 } } }
  })
}

export async function deleteHourOverride(date: string): Promise<ActionResult<null>> {
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(businessHourOverrides)
      .where(eq(businessHourOverrides.date, date))
      .returning({ date: businessHourOverrides.date })
    if (deleted.length === 0) return { status: 'not_found' }
    await audit(tx, { actor: 'owner', action: 'override.delete', entityType: 'override', entityId: date })
    return { status: 'ok', data: null }
  })
}

export async function updateSettings(input: {
  slotStepMin: number
  leadTimeMin: number
  maxAdvanceDays: number
  cancelDeadlineMin: number
  allowSameDay: boolean
}): Promise<ActionResult<null>> {
  await db.transaction(async (tx) => {
    await tx
      .update(settings)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(settings.id, 1))
    await audit(tx, { actor: 'owner', action: 'settings.update', entityType: 'settings', entityId: '1', diff: input })
  })
  return { status: 'ok', data: null }
}

export async function upsertMenu(input: UpsertMenuInput): Promise<ActionResult<{ menuId: string }>> {
  const values = {
    slug: input.slug,
    nameJa: input.nameJa,
    nameEn: input.nameEn,
    descriptionJa: input.descriptionJa ?? null,
    descriptionEn: input.descriptionEn ?? null,
    priceJpy: input.priceJpy,
    priceStudentJpy: input.priceStudentJpy ?? null,
    durationMin: input.durationMin,
    bufferAfterMin: input.bufferAfterMin,
    isActive: input.isActive,
  }
  try {
    return await db.transaction(async (tx) => {
      let menuId = input.id
      if (menuId) {
        const updated = await tx.update(menus).set(values).where(eq(menus.id, menuId)).returning({ id: menus.id })
        if (updated.length === 0) return { status: 'not_found' }
      } else {
        const [maxRow] = await tx.select({ v: sql<number>`coalesce(max(sort_order), 0)::int` }).from(menus)
        const [created] = await tx
          .insert(menus)
          .values({ ...values, sortOrder: (maxRow?.v ?? 0) + 1 })
          .returning({ id: menus.id })
        menuId = created?.id
      }
      if (!menuId) throw new Error('menu upsert returned no row')
      await audit(tx, {
        actor: 'owner',
        action: input.id ? 'menu.update' : 'menu.create',
        entityType: 'menu',
        entityId: menuId,
        diff: {
          priceJpy: input.priceJpy,
          priceStudentJpy: input.priceStudentJpy ?? null,
          durationMin: input.durationMin,
          bufferAfterMin: input.bufferAfterMin,
          isActive: input.isActive,
        },
      })
      return { status: 'ok', data: { menuId } }
    })
  } catch (err) {
    if (isUniqueViolation(err, 'menus_slug_unique')) return fieldError('slug', 'slugTaken')
    return errorResult(err, 'admin.menu_failed')
  }
}

export async function setMenuActive(menuId: string, isActive: boolean): Promise<ActionResult<null>> {
  return db.transaction(async (tx) => {
    const updated = await tx.update(menus).set({ isActive }).where(eq(menus.id, menuId)).returning({ id: menus.id })
    if (updated.length === 0) return { status: 'not_found' }
    await audit(tx, { actor: 'owner', action: 'menu.active', entityType: 'menu', entityId: menuId, diff: { isActive } })
    return { status: 'ok', data: null }
  })
}

/** Move one menu up / down in the customer-site order (swap sort_order with the neighbour). */
export async function moveMenu(menuId: string, direction: 'up' | 'down'): Promise<ActionResult<null>> {
  return db.transaction(async (tx) => {
    const all = await tx.select({ id: menus.id }).from(menus).orderBy(asc(menus.sortOrder), asc(menus.slug))
    const i = all.findIndex((m) => m.id === menuId)
    if (i < 0) return { status: 'not_found' }
    const j = direction === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= all.length) return { status: 'ok', data: null }
    const order = all.map((m) => m.id)
    ;[order[i], order[j]] = [order[j] as string, order[i] as string]
    for (const [index, id] of order.entries()) {
      await tx
        .update(menus)
        .set({ sortOrder: index + 1 })
        .where(eq(menus.id, id))
    }
    await audit(tx, {
      actor: 'owner',
      action: 'menu.reorder',
      entityType: 'menu',
      entityId: menuId,
      diff: { direction },
    })
    return { status: 'ok', data: null }
  })
}

// ------------------------------------------------------------------ push subscriptions (S-A-10)

export type SessionCtx = { userId: string; sessionId: string; userAgent: string | null }

export async function subscribePush(
  input: {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
    platform: 'ios' | 'android' | 'desktop' | 'other'
    replaceEndpoint?: string
  },
  ctx: SessionCtx,
): Promise<ActionResult<{ subscriptionId: string }>> {
  const now = new Date()
  return db.transaction(async (tx) => {
    if (input.replaceEndpoint && input.replaceEndpoint !== input.subscription.endpoint) {
      await tx
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.endpoint, input.replaceEndpoint), eq(pushSubscriptions.userId, ctx.userId)))
    }
    const values = {
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      platform: input.platform,
      userAgent: ctx.userAgent?.slice(0, 512) ?? null,
      lastSeenAt: now,
      failCount: 0,
    }
    const [row] = await tx
      .insert(pushSubscriptions)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values })
      .returning({ id: pushSubscriptions.id })
    if (!row) throw new Error('push subscription upsert returned no row')
    await audit(tx, {
      actor: 'owner',
      action: 'push_subscription.subscribe',
      entityType: 'push_subscription',
      entityId: row.id,
      diff: { platform: input.platform, replaced: Boolean(input.replaceEndpoint) },
    })
    return { status: 'ok', data: { subscriptionId: row.id } }
  })
}

export async function unsubscribePush(
  input: { endpoint?: string; subscriptionId?: string },
  userId: string,
): Promise<ActionResult<null>> {
  const cond = input.subscriptionId
    ? eq(pushSubscriptions.id, input.subscriptionId)
    : input.endpoint
      ? eq(pushSubscriptions.endpoint, input.endpoint)
      : null
  if (!cond) return fieldError('endpoint', 'invalid')
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(pushSubscriptions)
      .where(and(cond, eq(pushSubscriptions.userId, userId)))
      .returning({ id: pushSubscriptions.id })
    for (const d of deleted) {
      await audit(tx, {
        actor: 'owner',
        action: 'push_subscription.unsubscribe',
        entityType: 'push_subscription',
        entityId: d.id,
      })
    }
    return { status: 'ok', data: null }
  })
}

/** Launch-time heartbeat (AT-17): `known: false` tells the client to subscribe again. */
export async function touchPushSubscription(
  endpoint: string,
  ctx: SessionCtx,
): Promise<ActionResult<{ known: boolean }>> {
  const updated = await db
    .update(pushSubscriptions)
    .set({ lastSeenAt: new Date(), sessionId: ctx.sessionId })
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, ctx.userId)))
    .returning({ id: pushSubscriptions.id })
  return { status: 'ok', data: { known: updated.length > 0 } }
}

/** POST /api/admin/push/rotate (Android pushsubscriptionchange). */
export async function rotatePushSubscription(
  input: { oldEndpoint?: string; subscription: { endpoint: string; keys: { p256dh: string; auth: string } } },
  ctx: SessionCtx,
): Promise<void> {
  const [old] = input.oldEndpoint
    ? await db
        .select({ platform: pushSubscriptions.platform })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.oldEndpoint))
        .limit(1)
    : []
  await subscribePush(
    {
      subscription: input.subscription,
      platform: old?.platform ?? 'android',
      ...(input.oldEndpoint ? { replaceEndpoint: input.oldEndpoint } : {}),
    },
    ctx,
  )
}

export type TestPushResult = { subscriptionId: string; platform: string; httpStatus: number | null; error?: string }

export async function sendTestPush(ctx: AdminCtx = {}): Promise<ActionResult<{ results: TestPushResult[] }>> {
  const now = ctx.now ?? new Date()
  const unread = await countUnacknowledged()
  const payload = buildDeclarativePayload({
    title: 'テスト通知',
    body: 'この通知が見えていれば、新しい予約の通知も届きます。',
    navigate: absoluteUrl('/admin/settings/notifications?test=received'),
    tag: `test-${now.getTime()}`,
    data: { kind: 'test' },
    badge: unread,
  })
  const results: PushSendResult[] = await sendPushToAll(payload, {
    template: 'test',
    scheduledFor: now,
    urgency: 'high',
    topic: 'test',
    now,
  })
  return {
    status: 'ok',
    data: {
      results: results.map((r) => ({
        subscriptionId: r.subscriptionId,
        platform: r.platform,
        httpStatus: r.httpStatus,
        ...(r.error ? { error: r.error } : {}),
      })),
    },
  }
}

/**
 * logoutOtherDevices (FR-A-16, AT-19): delete push subscriptions not tied to this session,
 * then revoke every other session of the admin — one transaction.
 */
export async function logoutOtherDevices(
  ctx: Pick<SessionCtx, 'userId' | 'sessionId'>,
): Promise<ActionResult<{ revokedSessions: number; removedSubscriptions: number }>> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, ctx.userId),
          or(isNull(pushSubscriptions.sessionId), ne(pushSubscriptions.sessionId, ctx.sessionId)),
        ),
      )
      .returning({ id: pushSubscriptions.id })
    const revoked = await tx
      .delete(authSession)
      .where(and(eq(authSession.userId, ctx.userId), ne(authSession.id, ctx.sessionId)))
      .returning({ id: authSession.id })
    await audit(tx, {
      actor: 'owner',
      action: 'session.revoke_others',
      entityType: 'session',
      entityId: ctx.sessionId,
      diff: { revokedSessions: revoked.length, removedSubscriptions: removed.length },
    })
    return { status: 'ok', data: { revokedSessions: revoked.length, removedSubscriptions: removed.length } }
  })
}

// ------------------------------------------------------------------ customers (S-A-11, Should)

export async function updateCustomerRestriction(
  customerId: string,
  restriction: 'none' | 'dm_only' | 'blocked',
): Promise<ActionResult<null>> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(customers)
      .set({ bookingRestriction: restriction })
      .where(and(eq(customers.id, customerId), isNull(customers.anonymizedAt)))
      .returning({ id: customers.id })
    if (updated.length === 0) return { status: 'not_found' }
    await audit(tx, {
      actor: 'owner',
      action: 'customer.restriction',
      entityType: 'customer',
      entityId: customerId,
      diff: { restriction },
    })
    return { status: 'ok', data: null }
  })
}

/** exportCustomer (FR-A-14): customer, bookings, consents — never IP / UA / token hashes. */
export async function exportCustomer(customerId: string): Promise<ActionResult<{ filename: string; json: string }>> {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(customers).where(eq(customers.id, customerId)).limit(1)
    if (!c) return { status: 'not_found' }
    const rows = await tx.execute<{
      public_code: string
      start_at: string
      end_at: string
      status: string
      source: string
      price_jpy: number
      is_student: boolean
      note: string | null
      menu: string
      created_at: string
    }>(sql`
      SELECT b.public_code, lower(b.during) AS start_at, upper(b.during) AS end_at, b.status, b.source,
             b.price_jpy, b.is_student, b.note, m.name_ja AS menu, b.created_at
      FROM bookings b JOIN menus m ON m.id = b.menu_id
      WHERE b.customer_id = ${customerId} ORDER BY lower(b.during)
    `)
    const consentRows = await tx
      .select({
        kind: consents.kind,
        policyVersion: consents.policyVersion,
        acceptedAt: consents.acceptedAt,
        revokedAt: consents.revokedAt,
      })
      .from(consents)
      .where(eq(consents.customerId, customerId))
      .orderBy(desc(consents.acceptedAt))
    const data = {
      exportedAt: new Date().toISOString(),
      customer: {
        id: c.id,
        name: c.name,
        nameKana: c.nameKana,
        phone: c.phoneE164,
        occupation: c.occupation,
        locale: c.locale,
        noShowCount: c.noShowCount,
        lateCancelCount: c.lateCancelCount,
        bookingRestriction: c.bookingRestriction,
        lastVisitAt: c.lastVisitAt,
        anonymizedAt: c.anonymizedAt,
        createdAt: c.createdAt,
      },
      bookings: rows.rows.map((r) => ({
        publicCode: r.public_code,
        start: toJstIso(new Date(r.start_at)),
        end: toJstIso(new Date(r.end_at)),
        status: r.status,
        source: r.source,
        menu: r.menu,
        priceJpy: r.price_jpy,
        isStudent: r.is_student,
        note: r.note,
        createdAt: toJstIso(new Date(r.created_at)),
      })),
      consents: consentRows,
    }
    await audit(tx, { actor: 'owner', action: 'customer.export', entityType: 'customer', entityId: customerId })
    return {
      status: 'ok',
      data: { filename: `customer-${customerId.slice(0, 8)}.json`, json: JSON.stringify(data, null, 2) },
    }
  })
}

/**
 * anonymizeCustomer (FR-A-14, AT-30, 04_data_model.md §8): future active bookings are cancelled
 * first, then PII is cleared in one transaction (the customers_anonymized_clean CHECK forbids a
 * partial result). Identity is confirmed with the phone's last 4 digits when a phone exists.
 */
export async function anonymizeCustomer(
  input: { customerId: string; confirmPhoneLast4?: string },
  ctx: AdminCtx = {},
): Promise<ActionResult<{ cancelledBookings: number }>> {
  const now = ctx.now ?? new Date()
  return db.transaction(async (tx) => {
    await lockCalendar(tx)
    const res = await tx.execute<{ id: string; phone_e164: string | null; anonymized_at: string | null }>(sql`
      SELECT id, phone_e164, anonymized_at FROM customers WHERE id = ${input.customerId} FOR UPDATE
    `)
    const c = res.rows[0]
    if (!c || c.anonymized_at) return { status: 'not_found' }
    if (c.phone_e164 && input.confirmPhoneLast4 !== phoneTail(c.phone_e164)) {
      return fieldError('confirmPhoneLast4', 'last4Mismatch')
    }
    const cancelled = await tx.execute<{ id: string }>(sql`
      UPDATE bookings
      SET status = 'cancelled_by_owner', cancelled_at = ${now.toISOString()}::timestamptz,
          cancel_reason = 'anonymized', cancel_token_hash = NULL, status_changed_at = ${now.toISOString()}::timestamptz
      WHERE customer_id = ${c.id} AND status IN ('confirmed', 'arrived', 'in_progress')
        AND lower(during) > ${now.toISOString()}::timestamptz
      RETURNING id
    `)
    // Free-text cancel reasons may contain PII; the fixed markers stay (CR-20).
    await tx
      .update(bookings)
      .set({
        note: null,
        ownerNote: null,
        cancelTokenHash: null,
        cancelReason: sql`CASE WHEN ${bookings.cancelReason} IN ('deleted', 'anonymized') THEN ${bookings.cancelReason} END`,
      })
      .where(eq(bookings.customerId, c.id))
    await tx.update(consents).set({ ipHash: null, userAgent: null }).where(eq(consents.customerId, c.id))
    await tx
      .update(customers)
      .set({
        name: null,
        nameKana: null,
        phoneE164: null,
        phoneDisplay: null,
        lineUserId: null,
        instagramUserId: null,
        phoneHash: c.phone_e164 ? Buffer.from(piiHmac(c.phone_e164), 'base64url') : null,
        anonymizedAt: now,
      })
      .where(eq(customers.id, c.id))
    await audit(tx, {
      actor: 'owner',
      action: 'customer.anonymize',
      entityType: 'customer',
      entityId: c.id,
      diff: { cancelledFutureBookings: cancelled.rows.length },
    })
    return { status: 'ok', data: { cancelledBookings: cancelled.rows.length } }
  })
}

// ------------------------------------------------------------------ login fallback (06 §3.0)

export const OTP_LIMITS = {
  requestIp: { windowSec: 600, limit: 3 },
  /** All IPs together (SR-09): bounds mail volume (Resend free tier 100/day) whatever the IP. */
  requestGlobalPerDay: { windowSec: 86_400, limit: 10 },
  verifyIp: { windowSec: 600, limit: 10 },
  verifyAccountPerHour: { windowSec: 3600, limit: 20 },
} as const

export type OtpCtx = { ip: string; headers: Headers; now?: Date }

/**
 * requestAdminOtp: the address is fixed server-side (ADMIN_EMAIL), never taken from input, and
 * the response is identical whether or not a code was sent (enumeration resistance).
 */
export async function requestAdminOtp(ctx: OtpCtx): Promise<ActionResult<null>> {
  const { windowSec, limit } = OTP_LIMITS.requestIp
  const rate = await hitWindow(`otp:ip:${piiHmac(ctx.ip)}`, windowSec, limit, { now: ctx.now })
  if (!rate.ok) return { status: 'rate_limited', retryAfterSec: rate.retryAfterSec }
  const global = OTP_LIMITS.requestGlobalPerDay
  const globalRate = await hitWindow('otp:global', global.windowSec, global.limit, { now: ctx.now })
  if (!globalRate.ok) {
    await audit(db, {
      actor: 'system',
      action: 'auth.otp_global_limit',
      entityType: 'session',
      entityId: 'otp',
      diff: { limit: global.limit },
    })
    return { status: 'rate_limited', retryAfterSec: globalRate.retryAfterSec }
  }
  // Lower-case everywhere (seed, lookup, Better Auth) so a capitalised ADMIN_EMAIL still works (CR-23).
  const email = env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!email) {
    logger.warn('admin_otp.no_admin_email', {})
    return { status: 'ok', data: null }
  }
  const [user] = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(sql`lower(${authUser.email}) = ${email}`)
    .limit(1)
  if (!user) {
    logger.warn('admin_otp.admin_not_seeded', {})
    return { status: 'ok', data: null }
  }
  try {
    await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' }, headers: ctx.headers })
    await audit(db, { actor: 'system', action: 'auth.otp_requested', entityType: 'session', entityId: user.id })
  } catch (err) {
    logger.error('admin_otp.request_failed', errorFields(err))
  }
  return { status: 'ok', data: null }
}

/** verifyAdminOtp: Better Auth checks expiry (10 min) and attempts (5); success sets the cookie. */
export async function verifyAdminOtp(
  input: { code: string; next?: string },
  ctx: OtpCtx,
): Promise<ActionResult<{ redirectTo: string }>> {
  const ipRate = await hitWindow(
    `login:ip:${piiHmac(ctx.ip)}`,
    OTP_LIMITS.verifyIp.windowSec,
    OTP_LIMITS.verifyIp.limit,
    {
      now: ctx.now,
    },
  )
  if (!ipRate.ok) return { status: 'rate_limited', retryAfterSec: ipRate.retryAfterSec }
  const acctRate = await hitWindow(
    'login:acct',
    OTP_LIMITS.verifyAccountPerHour.windowSec,
    OTP_LIMITS.verifyAccountPerHour.limit,
    { now: ctx.now },
  )
  if (!acctRate.ok) return { status: 'rate_limited', retryAfterSec: acctRate.retryAfterSec }
  const email = env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!email) return fieldError('code', 'otpInvalid')
  try {
    const res = await auth.api.signInEmailOTP({ body: { email, otp: input.code }, headers: ctx.headers })
    await audit(db, { actor: 'owner', action: 'auth.otp_login', entityType: 'session', entityId: res.user.id })
  } catch {
    return fieldError('code', 'otpInvalid')
  }
  return { status: 'ok', data: { redirectTo: safeAdminNext(input.next) } }
}

export type { OverlapDTO }
