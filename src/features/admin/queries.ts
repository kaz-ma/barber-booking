import 'server-only'
import { asc, eq, gte, sql } from 'drizzle-orm'
import { ACTIVE_STATUSES, type BookingStatus } from '@/domain/booking-status'
import { jstInstant, minutesFromJstMidnight } from '@/domain/jst-format'
import { toHiragana } from '@/domain/kana'
import { isValidE164, normalizePhone } from '@/domain/phone'
import { addDays, jstDate, toJstIso } from '@/domain/time'
import { isUuid } from '@/domain/uuid'
import { db } from '@/lib/db'
import { authPasskey, businessHourOverrides, businessHours, menus, settings } from '@/lib/db/schema'
import { countUnacknowledged } from '@/lib/notify'
import { findOverlaps, hoursForDate } from './calendar'
import type { HoursForDate, OverlapDTO } from './types'

/*
 * Admin DAL (06_api.md §2.2 / §4). Never cached: every call reads the database (the admin
 * views are the source of truth while the owner works). Callers run requireAdmin first.
 * DTOs carry JST ISO strings; token hashes, idempotency keys, IP and UA never leave here.
 */

const DEFAULT_AXIS = { startMin: 18 * 60, endMin: 24 * 60 }

export type AgendaBooking = {
  id: string
  start: string
  /** display end (without buffer) */
  end: string
  startMin: number
  endMin: number
  status: BookingStatus
  source: string
  name: string | null
  nameKana: string | null
  phoneE164: string | null
  menuName: string
  hasNote: boolean
  isStudent: boolean
  unacknowledged: boolean
}

export type AgendaBlock = {
  id: string
  start: string
  end: string
  startMin: number
  endMin: number
  kind: string
  label: string | null
}

export type DayAgenda = {
  date: string
  hours: HoursForDate
  axis: { startMin: number; endMin: number }
  bookings: AgendaBooking[]
  blocks: AgendaBlock[]
  cancelledCount: number
  freeMinutes: number
}

type BookingRow = {
  id: string
  start_at: string
  end_at: string
  buffer_min: number
  status: BookingStatus
  source: string
  name: string | null
  name_kana: string | null
  phone_e164: string | null
  menu_name: string
  has_note: boolean
  is_student: boolean
  unacknowledged: boolean
}

type BlockRow = { id: string; start_at: string; end_at: string; kind: string; label: string | null }

async function loadRange(from: string, toExclusive: string) {
  const range = sql`tstzrange(${jstInstant(from, 0).toISOString()}::timestamptz, ${jstInstant(toExclusive, 0).toISOString()}::timestamptz, '[)')`
  const [bookingRes, blockRes] = await Promise.all([
    db.execute<BookingRow>(sql`
      SELECT b.id, lower(b.during) AS start_at, upper(b.during) AS end_at, b.buffer_min, b.status, b.source,
             c.name, c.name_kana, c.phone_e164, m.name_ja AS menu_name,
             (b.note IS NOT NULL OR b.owner_note IS NOT NULL) AS has_note, b.is_student,
             (b.acknowledged_at IS NULL AND b.source = 'web') AS unacknowledged
      FROM bookings b
      JOIN customers c ON c.id = b.customer_id
      JOIN menus m ON m.id = b.menu_id
      WHERE b.during && ${range} AND b.deleted_at IS NULL
      ORDER BY lower(b.during)
    `),
    db.execute<BlockRow>(sql`
      SELECT id, lower(during) AS start_at, upper(during) AS end_at, kind, label
      FROM time_blocks WHERE during && ${range} AND deleted_at IS NULL ORDER BY lower(during)
    `),
  ])
  return { bookings: bookingRes.rows, blocks: blockRes.rows }
}

const TIMELINE_STATUSES: readonly BookingStatus[] = [...ACTIVE_STATUSES, 'completed']

/** Merge intervals and return the minutes inside [open, close) not covered by any of them. */
function freeMinutesWithin(open: number, close: number, busy: { s: number; e: number }[]): number {
  const clipped = busy
    .map((b) => ({ s: Math.max(open, b.s), e: Math.min(close, b.e) }))
    .filter((b) => b.e > b.s)
    .sort((a, b) => a.s - b.s)
  let covered = 0
  let curS = -1
  let curE = -1
  for (const b of clipped) {
    if (b.s > curE) {
      if (curE > curS) covered += curE - curS
      curS = b.s
      curE = b.e
    } else curE = Math.max(curE, b.e)
  }
  if (curE > curS) covered += curE - curS
  return Math.max(0, close - open - covered)
}

function toAgenda(date: string, hours: HoursForDate, rows: { bookings: BookingRow[]; blocks: BlockRow[] }): DayAgenda {
  const dayStart = jstInstant(date, 0).getTime()
  const dayEnd = jstInstant(date, 1440).getTime()
  const inDay = (s: string, e: string) => new Date(s).getTime() < dayEnd && new Date(e).getTime() > dayStart
  const timeline = rows.bookings.filter((b) => TIMELINE_STATUSES.includes(b.status) && inDay(b.start_at, b.end_at))
  const bookings: AgendaBooking[] = timeline.map((b) => {
    const start = new Date(b.start_at)
    const end = new Date(new Date(b.end_at).getTime() - b.buffer_min * 60_000)
    return {
      id: b.id,
      start: toJstIso(start),
      end: toJstIso(end),
      startMin: minutesFromJstMidnight(start, date),
      endMin: minutesFromJstMidnight(end, date),
      status: b.status,
      source: b.source,
      name: b.name,
      nameKana: b.name_kana,
      phoneE164: b.phone_e164,
      menuName: b.menu_name,
      hasNote: b.has_note,
      isStudent: b.is_student,
      unacknowledged: b.unacknowledged,
    }
  })
  const blocks: AgendaBlock[] = rows.blocks
    .filter((t) => inDay(t.start_at, t.end_at))
    .map((t) => ({
      id: t.id,
      start: toJstIso(new Date(t.start_at)),
      end: toJstIso(new Date(t.end_at)),
      startMin: Math.max(0, minutesFromJstMidnight(new Date(t.start_at), date)),
      endMin: Math.min(1440, minutesFromJstMidnight(new Date(t.end_at), date)),
      kind: t.kind,
      label: t.label,
    }))
  const cancelledCount = rows.bookings.filter(
    (b) => !TIMELINE_STATUSES.includes(b.status) && inDay(b.start_at, b.end_at),
  ).length

  // 15-minute axis: opening hours, widened to whole hours around anything outside them.
  let startMin = hours.openMin ?? DEFAULT_AXIS.startMin
  let endMin = hours.closeMin ?? DEFAULT_AXIS.endMin
  for (const item of [...bookings, ...blocks]) {
    startMin = Math.min(startMin, Math.floor(Math.max(0, item.startMin) / 60) * 60)
    endMin = Math.max(endMin, Math.ceil(Math.min(1440, item.endMin) / 60) * 60)
  }
  const busy = [
    ...timeline
      .filter((b) => (ACTIVE_STATUSES as readonly string[]).includes(b.status) || b.status === 'completed')
      .map((b) => ({
        s: minutesFromJstMidnight(new Date(b.start_at), date),
        e: minutesFromJstMidnight(new Date(b.end_at), date),
      })),
    ...blocks.map((b) => ({ s: b.startMin, e: b.endMin })),
  ]
  const freeMinutes =
    hours.isClosed || hours.openMin === null || hours.closeMin === null
      ? 0
      : freeMinutesWithin(hours.openMin, hours.closeMin, busy)
  return { date, hours, axis: { startMin, endMin }, bookings, blocks, cancelledCount, freeMinutes }
}

/** S-A-02 today / day view (FR-A-02). */
export async function getDayAgenda(date: string): Promise<DayAgenda> {
  const [hours, rows] = await Promise.all([hoursForDate(db, date), loadRange(date, addDays(date, 1))])
  return toAgenda(date, hours, rows)
}

export type WeekDay = {
  date: string
  isClosed: boolean
  bookingCount: number
  blockCount: number
  freeMinutes: number
  unacknowledged: number
}

/** S-A-03 week view (FR-A-03): 7 columns from `start`. */
export async function getWeek(start: string): Promise<WeekDay[]> {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const [rows, hoursList] = await Promise.all([
    loadRange(start, addDays(start, 7)),
    Promise.all(dates.map((d) => hoursForDate(db, d))),
  ])
  return dates.map((date, i) => {
    const agenda = toAgenda(date, hoursList[i] as HoursForDate, rows)
    return {
      date,
      isClosed: agenda.hours.isClosed,
      bookingCount: agenda.bookings.length,
      blockCount: agenda.blocks.length,
      freeMinutes: agenda.freeMinutes,
      unacknowledged: agenda.bookings.filter((b) => b.unacknowledged).length,
    }
  })
}

export type InboxItem = {
  id: string
  kind: 'new' | 'cancel'
  start: string
  menuName: string
  source: string
  name: string | null
  nameKana: string | null
  isStudent: boolean
  /** when it arrived (created / cancelled) */
  at: string
}

type InboxRow = {
  id: string
  status: string
  start_at: string
  menu_name: string
  source: string
  name: string | null
  name_kana: string | null
  is_student: boolean
  at: string
}

function toInbox(r: InboxRow): InboxItem {
  return {
    id: r.id,
    kind: r.status === 'cancelled_by_customer' ? 'cancel' : 'new',
    start: toJstIso(new Date(r.start_at)),
    menuName: r.menu_name,
    source: r.source,
    name: r.name,
    nameKana: r.name_kana,
    isStudent: r.is_student,
    at: toJstIso(new Date(r.at)),
  }
}

/** S-A-07 inbox: unread (newest first) + acknowledged within 7 days. */
export async function getInbox(now: Date = new Date()): Promise<{ unread: InboxItem[]; read: InboxItem[] }> {
  const select = sql`
    SELECT b.id, b.status, lower(b.during) AS start_at, m.name_ja AS menu_name, b.source,
           c.name, c.name_kana, b.is_student, coalesce(b.cancelled_at, b.created_at) AS at
    FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN menus m ON m.id = b.menu_id`
  const [unread, read] = await Promise.all([
    db.execute<InboxRow>(sql`${select} WHERE b.acknowledged_at IS NULL AND b.deleted_at IS NULL
      AND (b.status = 'cancelled_by_customer' OR (b.source = 'web' AND b.status IN ('confirmed', 'arrived', 'in_progress')))
      ORDER BY at DESC LIMIT 100`),
    db.execute<InboxRow>(sql`${select} WHERE b.acknowledged_at > ${new Date(now.getTime() - 7 * 86_400_000).toISOString()}::timestamptz
      AND b.deleted_at IS NULL AND (b.status = 'cancelled_by_customer' OR b.source = 'web')
      ORDER BY at DESC LIMIT 50`),
  ])
  return { unread: unread.rows.map(toInbox), read: read.rows.map(toInbox) }
}

/** GET /api/admin/inbox-count (FR-A-11 polling). */
export async function getInboxCount(): Promise<{ unacknowledged: number; latestChangeAt: string | null }> {
  const [unacknowledged, latest] = await Promise.all([
    countUnacknowledged(),
    db.execute<{ t: string | null }>(sql`SELECT max(updated_at) AS t FROM bookings`),
  ])
  const t = latest.rows[0]?.t
  return { unacknowledged, latestChangeAt: t ? new Date(t).toISOString() : null }
}

export type BookingDetail = {
  id: string
  publicCode: string
  status: BookingStatus
  source: string
  locale: 'ja' | 'en'
  start: string
  end: string
  bufferMin: number
  durationMin: number
  priceJpy: number
  isStudent: boolean
  note: string | null
  ownerNote: string | null
  createdAt: string
  statusChangedAt: string
  acknowledgedAt: string | null
  cancelledAt: string | null
  hasCancelToken: boolean
  deleted: boolean
  menu: { id: string; nameJa: string }
  customer: {
    id: string
    name: string | null
    nameKana: string | null
    phoneE164: string | null
    phoneDisplay: string | null
    phoneUnverified: boolean
    noShowCount: number
    lateCancelCount: number
    visitCount: number
    restriction: string
    anonymized: boolean
  }
  consentVersions: { kind: string; version: string }[]
  history: { at: string; action: string; actor: string; diff: Record<string, unknown> }[]
}

type DetailRow = {
  id: string
  public_code: string
  status: BookingStatus
  source: string
  locale: 'ja' | 'en'
  start_at: string
  end_at: string
  buffer_min: number
  price_jpy: number
  is_student: boolean
  note: string | null
  owner_note: string | null
  created_at: string
  status_changed_at: string
  acknowledged_at: string | null
  cancelled_at: string | null
  has_token: boolean
  deleted: boolean
  menu_id: string
  menu_name: string
  customer_id: string
  name: string | null
  name_kana: string | null
  phone_e164: string | null
  phone_display: string | null
  phone_unverified: boolean
  no_show_count: number
  late_cancel_count: number
  booking_restriction: string
  anonymized_at: string | null
  visit_count: number
}

/** S-A-04 booking detail (FR-A-04). Deleted (soft) bookings are still readable for undo. */
export async function getBookingDetail(id: string): Promise<BookingDetail | null> {
  if (!isUuid(id)) return null
  const res = await db.execute<DetailRow>(sql`
    SELECT b.id, b.public_code, b.status, b.source, b.locale, lower(b.during) AS start_at, upper(b.during) AS end_at,
           b.buffer_min, b.price_jpy, b.is_student, b.note, b.owner_note, b.created_at, b.status_changed_at,
           b.acknowledged_at, b.cancelled_at, (b.cancel_token_hash IS NOT NULL) AS has_token,
           (b.deleted_at IS NOT NULL) AS deleted, m.id AS menu_id, m.name_ja AS menu_name,
           c.id AS customer_id, c.name, c.name_kana, c.phone_e164, c.phone_display, c.phone_unverified,
           c.no_show_count, c.late_cancel_count, c.booking_restriction, c.anonymized_at,
           (SELECT count(*)::int FROM bookings v WHERE v.customer_id = c.id AND v.status = 'completed') AS visit_count
    FROM bookings b JOIN menus m ON m.id = b.menu_id JOIN customers c ON c.id = b.customer_id
    WHERE b.id = ${id}
  `)
  const r = res.rows[0]
  if (!r) return null
  const [consentRows, auditRows] = await Promise.all([
    db.execute<{ kind: string; policy_version: string }>(sql`
      SELECT kind, policy_version FROM consents WHERE booking_id = ${id} ORDER BY kind`),
    db.execute<{ created_at: string; action: string; actor: string; diff: Record<string, unknown> }>(sql`
      SELECT created_at, action, actor, diff FROM audit_log
      WHERE entity_type = 'booking' AND entity_id = ${id} ORDER BY created_at ASC LIMIT 50`),
  ])
  const start = new Date(r.start_at)
  const endWithBuffer = new Date(r.end_at)
  const end = new Date(endWithBuffer.getTime() - r.buffer_min * 60_000)
  return {
    id: r.id,
    publicCode: r.public_code,
    status: r.status,
    source: r.source,
    locale: r.locale,
    start: toJstIso(start),
    end: toJstIso(end),
    bufferMin: r.buffer_min,
    durationMin: Math.round((end.getTime() - start.getTime()) / 60_000),
    priceJpy: r.price_jpy,
    isStudent: r.is_student,
    note: r.note,
    ownerNote: r.owner_note,
    createdAt: toJstIso(new Date(r.created_at)),
    statusChangedAt: toJstIso(new Date(r.status_changed_at)),
    acknowledgedAt: r.acknowledged_at ? toJstIso(new Date(r.acknowledged_at)) : null,
    cancelledAt: r.cancelled_at ? toJstIso(new Date(r.cancelled_at)) : null,
    hasCancelToken: r.has_token,
    deleted: r.deleted,
    menu: { id: r.menu_id, nameJa: r.menu_name },
    customer: {
      id: r.customer_id,
      name: r.name,
      nameKana: r.name_kana,
      phoneE164: r.phone_e164,
      phoneDisplay: r.phone_display,
      phoneUnverified: r.phone_unverified,
      noShowCount: r.no_show_count,
      lateCancelCount: r.late_cancel_count,
      visitCount: r.visit_count,
      restriction: r.booking_restriction,
      anonymized: r.anonymized_at !== null,
    },
    consentVersions: consentRows.rows.map((c) => ({ kind: c.kind, version: c.policy_version })),
    history: auditRows.rows.map((a) => ({
      at: toJstIso(new Date(a.created_at)),
      action: a.action,
      actor: a.actor,
      diff: a.diff,
    })),
  }
}

/** GET /api/admin/overlaps (FR-A-05, 06). */
export async function getOverlaps(input: {
  start: Date
  end: Date
  excludeBookingId?: string
}): Promise<{ overlaps: OverlapDTO[]; outsideHours: boolean }> {
  const date = jstDate(input.start)
  const [overlaps, hours] = await Promise.all([
    findOverlaps(db, input.start, input.end, {
      includeBlocks: true,
      ...(input.excludeBookingId ? { excludeBookingId: input.excludeBookingId } : {}),
    }),
    hoursForDate(db, date),
  ])
  const s = minutesFromJstMidnight(input.start, date)
  const e = minutesFromJstMidnight(input.end, date)
  const outsideHours =
    hours.isClosed || hours.openMin === null || hours.closeMin === null || s < hours.openMin || e > hours.closeMin
  return { overlaps, outsideHours }
}

/**
 * Start times (15-minute grid inside opening hours, after `now`) where the menu fits without
 * touching an active booking or block — the "空き" chips of S-A-05.
 */
export async function getFreeStarts(input: { date: string; menuId: string; now?: Date }): Promise<string[]> {
  const now = input.now ?? new Date()
  const [menuRows, hours, rows] = await Promise.all([
    db.select({ d: menus.durationMin, b: menus.bufferAfterMin }).from(menus).where(eq(menus.id, input.menuId)).limit(1),
    hoursForDate(db, input.date),
    loadRange(input.date, addDays(input.date, 2)),
  ])
  const menu = menuRows[0]
  if (!menu || hours.isClosed || hours.openMin === null || hours.closeMin === null) return []
  const busy = [
    ...rows.bookings
      .filter((b) => (ACTIVE_STATUSES as readonly string[]).includes(b.status))
      .map((b) => ({ s: new Date(b.start_at).getTime(), e: new Date(b.end_at).getTime() })),
    ...rows.blocks.map((t) => ({ s: new Date(t.start_at).getTime(), e: new Date(t.end_at).getTime() })),
  ]
  const out: string[] = []
  const len = (menu.d + menu.b) * 60_000
  for (let m = hours.openMin; m + menu.d + menu.b <= hours.closeMin; m += 15) {
    const s = jstInstant(input.date, m).getTime()
    if (s <= now.getTime()) continue
    if (busy.some((b) => b.s < s + len && b.e > s)) continue
    out.push(toJstIso(new Date(s)))
  }
  return out
}

export type CustomerSuggestion = {
  id: string
  name: string | null
  nameKana: string | null
  phoneLast4: string | null
  visitCount: number
  lastVisitAt: string | null
  restriction: string
}

type CustomerRow = {
  id: string
  name: string | null
  name_kana: string | null
  phone_e164: string | null
  visit_count: number
  last_visit_at: string | null
  booking_restriction: string
  no_show_count: number
  late_cancel_count: number
  created_at: string
}

function toSuggestion(r: CustomerRow): CustomerSuggestion {
  return {
    id: r.id,
    name: r.name,
    nameKana: r.name_kana,
    phoneLast4: r.phone_e164 ? r.phone_e164.slice(-4) : null,
    visitCount: r.visit_count,
    lastVisitAt: r.last_visit_at ? toJstIso(new Date(r.last_visit_at)) : null,
    restriction: r.booking_restriction,
  }
}

const customerSelect = sql`
  SELECT c.id, c.name, c.name_kana, c.phone_e164, c.last_visit_at, c.booking_restriction,
         c.no_show_count, c.late_cancel_count, c.created_at,
         (SELECT count(*)::int FROM bookings v WHERE v.customer_id = c.id AND v.status = 'completed') AS visit_count
  FROM customers c`

function customerFilter(q: string) {
  const phone = normalizePhone(q)
  const kana = toHiragana(q)
  const like = `%${kana.replace(/[%_\\]/g, (ch) => `\\${ch}`)}%`
  const nameLike = `%${q.trim().replace(/[%_\\]/g, (ch) => `\\${ch}`)}%`
  return sql`c.anonymized_at IS NULL AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL AND (
    ${isValidE164(phone) ? sql`c.phone_e164 = ${phone} OR` : sql``}
    c.name_kana ILIKE ${like} OR c.name ILIKE ${nameLike})`
}

/** GET /api/admin/customers/suggest: phone exact, kana / name partial, at most 8. */
export async function suggestCustomers(q: string): Promise<CustomerSuggestion[]> {
  const term = q.trim()
  if (term.length < 2 || term.length > 50) return []
  const res = await db.execute<CustomerRow>(sql`${customerSelect} WHERE ${customerFilter(term)}
    ORDER BY c.last_visit_at DESC NULLS LAST, c.created_at DESC LIMIT 8`)
  return res.rows.map(toSuggestion)
}

export type CustomerListItem = CustomerSuggestion & { noShowCount: number; lateCancelCount: number }

/** S-A-11 customer list / search (FR-A-13). */
export async function searchCustomers(q: string): Promise<CustomerListItem[]> {
  const term = q.trim()
  const where = term.length >= 2 ? customerFilter(term) : sql`c.anonymized_at IS NULL AND c.deleted_at IS NULL`
  const res = await db.execute<CustomerRow>(sql`${customerSelect} WHERE ${where}
    ORDER BY c.last_visit_at DESC NULLS LAST, c.created_at DESC LIMIT 50`)
  return res.rows.map((r) => ({
    ...toSuggestion(r),
    noShowCount: r.no_show_count,
    lateCancelCount: r.late_cancel_count,
  }))
}

export type CustomerDetail = CustomerListItem & {
  instagramHandle: string | null
  phoneE164: string | null
  phoneUnverified: boolean
  bookings: { id: string; start: string; status: string; menuName: string }[]
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  if (!isUuid(id)) return null
  const res = await db.execute<CustomerRow & { phone_unverified: boolean; instagram_handle: string | null }>(sql`
    SELECT c.id, c.name, c.name_kana, c.phone_e164, c.phone_unverified, c.instagram_handle, c.last_visit_at, c.booking_restriction,
           c.no_show_count, c.late_cancel_count, c.created_at,
           (SELECT count(*)::int FROM bookings v WHERE v.customer_id = c.id AND v.status = 'completed') AS visit_count
    FROM customers c WHERE c.id = ${id} AND c.anonymized_at IS NULL`)
  const r = res.rows[0]
  if (!r) return null
  const b = await db.execute<{ id: string; start_at: string; status: string; menu_name: string }>(sql`
    SELECT b.id, lower(b.during) AS start_at, b.status, m.name_ja AS menu_name
    FROM bookings b JOIN menus m ON m.id = b.menu_id
    WHERE b.customer_id = ${id} ORDER BY lower(b.during) DESC LIMIT 30`)
  return {
    ...toSuggestion(r),
    noShowCount: r.no_show_count,
    lateCancelCount: r.late_cancel_count,
    instagramHandle: r.instagram_handle,
    phoneE164: r.phone_e164,
    phoneUnverified: r.phone_unverified,
    bookings: b.rows.map((x) => ({
      id: x.id,
      start: toJstIso(new Date(x.start_at)),
      status: x.status,
      menuName: x.menu_name,
    })),
  }
}

// ------------------------------------------------------------------ settings screens

export type AdminMenu = {
  id: string
  slug: string
  nameJa: string
  nameEn: string
  descriptionJa: string | null
  descriptionEn: string | null
  priceJpy: number
  priceStudentJpy: number | null
  durationMin: number
  bufferAfterMin: number
  sortOrder: number
  isActive: boolean
}

export async function getAdminMenus(): Promise<AdminMenu[]> {
  const rows = await db.select().from(menus).orderBy(asc(menus.sortOrder), asc(menus.slug))
  return rows.map((m) => ({
    id: m.id,
    slug: m.slug,
    nameJa: m.nameJa,
    nameEn: m.nameEn,
    descriptionJa: m.descriptionJa,
    descriptionEn: m.descriptionEn,
    priceJpy: m.priceJpy,
    priceStudentJpy: m.priceStudentJpy,
    durationMin: m.durationMin,
    bufferAfterMin: m.bufferAfterMin,
    sortOrder: m.sortOrder,
    isActive: m.isActive,
  }))
}

export type AdminHours = {
  week: { weekday: number; isClosed: boolean; openMin: number | null; closeMin: number | null }[]
  overrides: {
    date: string
    isClosed: boolean
    openMin: number | null
    closeMin: number | null
    reason: string | null
  }[]
}

export async function getAdminHours(now: Date = new Date()): Promise<AdminHours> {
  const today = jstDate(now)
  const [week, overrides] = await Promise.all([
    db.select().from(businessHours).orderBy(asc(businessHours.weekday)),
    db
      .select()
      .from(businessHourOverrides)
      .where(gte(businessHourOverrides.date, today))
      .orderBy(asc(businessHourOverrides.date)),
  ])
  return {
    week: week.map((w) => ({ weekday: w.weekday, isClosed: w.isClosed, openMin: w.openMin, closeMin: w.closeMin })),
    overrides: overrides.map((o) => ({
      date: o.date,
      isClosed: o.isClosed,
      openMin: o.openMin,
      closeMin: o.closeMin,
      reason: o.reason,
    })),
  }
}

export type AdminSettings = {
  slotStepMin: number
  leadTimeMin: number
  maxAdvanceDays: number
  cancelDeadlineMin: number
  allowSameDay: boolean
  digestHourJst: number
}

export async function getAdminSettings(): Promise<AdminSettings> {
  const [s] = await db.select().from(settings).limit(1)
  return {
    slotStepMin: s?.slotStepMin ?? 30,
    leadTimeMin: s?.leadTimeMin ?? 60,
    maxAdvanceDays: s?.maxAdvanceDays ?? 60,
    cancelDeadlineMin: s?.cancelDeadlineMin ?? 120,
    allowSameDay: s?.allowSameDay ?? true,
    digestHourJst: s?.digestHourJst ?? 21,
  }
}

export async function countPasskeys(userId: string): Promise<number> {
  const rows = await db.select({ id: authPasskey.id }).from(authPasskey).where(eq(authPasskey.userId, userId))
  return rows.length
}
