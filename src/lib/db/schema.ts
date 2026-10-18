import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authSession, authUser } from './auth-schema'
import { bytea, tstzrange } from './custom-types'

export * from './auth-schema'

/*
 * Mirrors the logical DDL in docs/03_design/04_data_model.md §3.
 * drizzle/0001_init.sql is generated from this file. What the DSL cannot express lives in
 * hand-written migrations (ADR-0003):
 *   - drizzle/0000_extensions.sql  btree_gist, pg_trgm
 *   - drizzle/0002_constraints.sql EXCLUDE bookings_no_overlap, DEFERRABLE FKs, updated_at triggers
 * Never use `drizzle-kit push` (DZ-03): it does not know about the hand-written constraints.
 * CHECK / WHERE bodies use bare column names on purpose so the generated SQL is plain.
 */

const tz = (name: string) => timestamp(name, { withTimezone: true })

// ---------------------------------------------------------------- enums (M-06)
export const bookingStatus = pgEnum('booking_status', [
  'confirmed',
  'arrived',
  'in_progress',
  'completed',
  'cancelled_by_customer',
  'cancelled_by_owner',
  'cancelled_late',
  'no_show',
])
/** Statuses covered by the EXCLUDE constraint and the availability SQL. */
export const ACTIVE_STATUSES = ['confirmed', 'arrived', 'in_progress'] as const

export const bookingSource = pgEnum('booking_source', ['web', 'phone', 'walk_in', 'instagram', 'line', 'manual'])
export const occupation = pgEnum('occupation', ['student', 'worker'])
export const localeCode = pgEnum('locale_code', ['ja', 'en'])
export const bookingRestriction = pgEnum('booking_restriction', ['none', 'dm_only', 'blocked'])
export const blockKind = pgEnum('block_kind', ['break', 'private', 'closed', 'holiday'])
export const consentKind = pgEnum('consent_kind', [
  'booking_policy',
  'privacy',
  'health_notes',
  'photo_karte',
  'photo_sns',
  'marketing',
])
export const pushPlatform = pgEnum('push_platform', ['ios', 'android', 'desktop', 'other'])
export const notificationStatus = pgEnum('notification_status', ['sent', 'failed', 'expired'])

// ---------------------------------------------------------------- customers
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name'),
    nameKana: text('name_kana'),
    phoneE164: text('phone_e164'),
    phoneDisplay: text('phone_display'),
    phoneUnverified: boolean('phone_unverified').notNull().default(false),
    /** HMAC(phone_e164) kept after anonymization. */
    phoneHash: bytea('phone_hash'),
    occupation: occupation('occupation'),
    locale: localeCode('locale').notNull().default('ja'),
    noShowCount: integer('no_show_count').notNull().default(0),
    lateCancelCount: integer('late_cancel_count').notNull().default(0),
    bookingRestriction: bookingRestriction('booking_restriction').notNull().default('none'),
    mergedIntoCustomerId: uuid('merged_into_customer_id').references((): AnyPgColumn => customers.id),
    lineUserId: text('line_user_id').unique(),
    instagramUserId: text('instagram_user_id').unique(),
    /** Instagram username entered by the owner (B6: open the DM thread via ig.me). */
    instagramHandle: text('instagram_handle'),
    lastVisitAt: tz('last_visit_at'),
    /** B6: when the owner last sent a "time for your next visit" DM. */
    lastRemindedAt: tz('last_reminded_at'),
    anonymizedAt: tz('anonymized_at'),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
    deletedAt: tz('deleted_at'),
  },
  () => [
    check('customers_name_len', sql`name IS NULL OR char_length(name) BETWEEN 1 AND 50`),
    check('customers_name_kana_len', sql`name_kana IS NULL OR char_length(name_kana) <= 50`),
    check('customers_phone_e164_format', sql`phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'`),
    check('customers_phone_display_len', sql`phone_display IS NULL OR char_length(phone_display) <= 32`),
    check('customers_no_show_count_nonneg', sql`no_show_count >= 0`),
    check('customers_late_cancel_count_nonneg', sql`late_cancel_count >= 0`),
    check('customers_name_present', sql`anonymized_at IS NOT NULL OR name IS NOT NULL`),
    check(
      'customers_anonymized_clean',
      sql`anonymized_at IS NULL OR (name IS NULL AND name_kana IS NULL AND phone_e164 IS NULL AND phone_display IS NULL AND line_user_id IS NULL AND instagram_user_id IS NULL AND instagram_handle IS NULL)`,
    ),
    check(
      'customers_instagram_handle_format',
      sql`instagram_handle IS NULL OR instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'`,
    ),
    check('customers_not_self_merged', sql`merged_into_customer_id IS DISTINCT FROM id`),
    uniqueIndex('customers_phone_e164_uidx')
      .on(sql`phone_e164`)
      .where(sql`phone_e164 IS NOT NULL AND deleted_at IS NULL AND merged_into_customer_id IS NULL`),
    index('customers_name_kana_trgm_idx').using('gin', sql`name_kana gin_trgm_ops`),
    index('customers_retention_idx').on(sql`last_visit_at`).where(sql`anonymized_at IS NULL`),
  ],
)

// ---------------------------------------------------------------- menus
export const menus = pgTable(
  'menus',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    nameJa: text('name_ja').notNull(),
    nameEn: text('name_en').notNull(),
    descriptionJa: text('description_ja'),
    descriptionEn: text('description_en'),
    /** Tax included. */
    priceJpy: integer('price_jpy').notNull(),
    priceStudentJpy: integer('price_student_jpy'),
    durationMin: smallint('duration_min').notNull(),
    bufferAfterMin: smallint('buffer_after_min').notNull().default(0),
    sortOrder: smallint('sort_order').notNull().default(0),
    /** Hidden until prices are confirmed (OI-01). */
    isActive: boolean('is_active').notNull().default(false),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  () => [
    check('menus_slug_format', sql`slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check('menus_name_ja_len', sql`char_length(name_ja) BETWEEN 1 AND 40`),
    check('menus_name_en_len', sql`char_length(name_en) BETWEEN 1 AND 60`),
    check('menus_description_ja_len', sql`char_length(description_ja) <= 120`),
    check('menus_description_en_len', sql`char_length(description_en) <= 200`),
    check('menus_price_nonneg', sql`price_jpy >= 0`),
    check('menus_price_student_range', sql`price_student_jpy IS NULL OR price_student_jpy BETWEEN 0 AND price_jpy`),
    check('menus_duration_valid', sql`duration_min BETWEEN 15 AND 480 AND duration_min % 5 = 0`),
    check('menus_buffer_valid', sql`buffer_after_min BETWEEN 0 AND 120 AND buffer_after_min % 5 = 0`),
  ],
)

// ---------------------------------------------------------------- business hours
export const businessHours = pgTable(
  'business_hours',
  {
    /** 0 = Sunday … 6 = Saturday (same as extract(dow)). */
    weekday: smallint('weekday').primaryKey(),
    isClosed: boolean('is_closed').notNull().default(false),
    /** Minutes from 00:00 JST; 1440 = 24:00. */
    openMin: smallint('open_min'),
    closeMin: smallint('close_min'),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  () => [
    check('business_hours_weekday_range', sql`weekday BETWEEN 0 AND 6`),
    check('business_hours_open_range', sql`open_min BETWEEN 0 AND 1440`),
    check('business_hours_close_range', sql`close_min BETWEEN 0 AND 1440`),
    check(
      'business_hours_valid',
      sql`is_closed OR (open_min IS NOT NULL AND close_min IS NOT NULL AND open_min < close_min)`,
    ),
  ],
)

export const businessHourOverrides = pgTable(
  'business_hour_overrides',
  {
    /** JST calendar date. */
    date: date('date', { mode: 'string' }).primaryKey(),
    isClosed: boolean('is_closed').notNull().default(true),
    openMin: smallint('open_min'),
    closeMin: smallint('close_min'),
    reason: text('reason'),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  () => [
    check('overrides_open_range', sql`open_min BETWEEN 0 AND 1440`),
    check('overrides_close_range', sql`close_min BETWEEN 0 AND 1440`),
    check('overrides_reason_len', sql`char_length(reason) <= 100`),
    check(
      'overrides_valid',
      sql`is_closed OR (open_min IS NOT NULL AND close_min IS NOT NULL AND open_min < close_min)`,
    ),
  ],
)

// ---------------------------------------------------------------- settings (single row)
export const settings = pgTable(
  'settings',
  {
    id: smallint('id').primaryKey().default(1),
    slotStepMin: smallint('slot_step_min').notNull().default(30),
    leadTimeMin: smallint('lead_time_min').notNull().default(60),
    maxAdvanceDays: smallint('max_advance_days').notNull().default(60),
    cancelDeadlineMin: smallint('cancel_deadline_min').notNull().default(120),
    timezone: text('timezone').notNull().default('Asia/Tokyo'),
    allowSameDay: boolean('allow_same_day').notNull().default(true),
    digestHourJst: smallint('digest_hour_jst').notNull().default(21),
    /** B8: SHA-256 of the owner's calendar feed token (the raw token is shown once). */
    calendarFeedTokenHash: bytea('calendar_feed_token_hash'),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  () => [
    check('settings_single_row', sql`id = 1`),
    check('settings_slot_step', sql`slot_step_min IN (10, 15, 20, 30, 60)`),
    check('settings_lead_time', sql`lead_time_min BETWEEN 0 AND 2880`),
    check('settings_max_advance', sql`max_advance_days BETWEEN 1 AND 365`),
    check('settings_cancel_deadline', sql`cancel_deadline_min BETWEEN 0 AND 10080`),
    check('settings_timezone', sql`timezone = 'Asia/Tokyo'`),
    check('settings_digest_hour', sql`digest_hour_jst BETWEEN 0 AND 23`),
    check(
      'settings_calendar_feed_hash_len',
      sql`calendar_feed_token_hash IS NULL OR octet_length(calendar_feed_token_hash) = 32`,
    ),
  ],
)

// ---------------------------------------------------------------- consents
export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    /** DEFERRABLE FK added in 0002_constraints.sql. */
    bookingId: uuid('booking_id'),
    kind: consentKind('kind').notNull(),
    policyVersion: text('policy_version').notNull(),
    acceptedAt: tz('accepted_at').notNull().defaultNow(),
    revokedAt: tz('revoked_at'),
    /**
     * HMAC-SHA256(PII_HASH_SECRET, client IP), base64url 22 chars — never the raw IP
     * (AGENTS.md rule 5, SR-15; 0004_consent_ip_hash.sql). Nulled after 1 year (10.3).
     */
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  () => [
    check('consents_policy_version_len', sql`char_length(policy_version) <= 32`),
    check('consents_user_agent_len', sql`char_length(user_agent) <= 512`),
    check('consents_ip_hash_len', sql`char_length(ip_hash) <= 32`),
    index('consents_customer_idx').on(sql`customer_id`, sql`accepted_at DESC`),
    index('consents_pii_purge_idx').on(sql`accepted_at`).where(sql`ip_hash IS NOT NULL OR user_agent IS NOT NULL`),
  ],
)

// ---------------------------------------------------------------- bookings
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Crockford base32, 8 chars. Display only, never an authorization. */
    publicCode: text('public_code').notNull().unique(),
    resourceId: smallint('resource_id').notNull().default(1),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    menuId: uuid('menu_id')
      .notNull()
      .references(() => menus.id),
    /** [start, start + duration + buffer) */
    during: tstzrange('during').notNull(),
    status: bookingStatus('status').notNull().default('confirmed'),
    source: bookingSource('source').notNull(),
    locale: localeCode('locale').notNull().default('ja'),
    /** Applied price snapshot (M-04). */
    priceJpy: integer('price_jpy').notNull(),
    isStudent: boolean('is_student').notNull().default(false),
    /** Display end = upper(during) - buffer_min. */
    bufferMin: smallint('buffer_min').notNull().default(0),
    note: text('note'),
    ownerNote: text('owner_note'),
    idempotencyKey: text('idempotency_key'),
    submissionNonceHash: bytea('submission_nonce_hash'),
    cancelTokenHash: bytea('cancel_token_hash').unique(),
    cancelTokenExpiresAt: tz('cancel_token_expires_at'),
    cancelledAt: tz('cancelled_at'),
    cancelReason: text('cancel_reason'),
    /** DEFERRABLE FK added in 0002_constraints.sql. */
    consentId: uuid('consent_id'),
    acknowledgedAt: tz('acknowledged_at'),
    lateMinutes: smallint('late_minutes'),
    statusChangedAt: tz('status_changed_at').notNull().defaultNow(),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
    deletedAt: tz('deleted_at'),
  },
  () => [
    check('bookings_public_code_format', sql`public_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'`),
    check('bookings_resource_id_positive', sql`resource_id >= 1`),
    check('bookings_price_nonneg', sql`price_jpy >= 0`),
    check('bookings_buffer_nonneg', sql`buffer_min >= 0`),
    check('bookings_note_len', sql`char_length(note) <= 500`),
    check('bookings_owner_note_len', sql`char_length(owner_note) <= 500`),
    check('bookings_idempotency_key_format', sql`idempotency_key IS NULL OR idempotency_key ~ '^[0-9a-f]{64}$'`),
    check('bookings_cancel_token_hash_len', sql`cancel_token_hash IS NULL OR octet_length(cancel_token_hash) = 32`),
    check('bookings_cancel_reason_len', sql`char_length(cancel_reason) <= 200`),
    check('bookings_late_minutes_nonneg', sql`late_minutes >= 0`),
    // Half-open [start, end): a booking ending 19:00 and one starting 19:00 do not overlap.
    check(
      'bookings_during_half_open',
      sql`lower_inc(during) AND NOT upper_inc(during) AND NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during)`,
    ),
    check(
      'bookings_cancel_consistency',
      sql`(status IN ('cancelled_by_customer', 'cancelled_by_owner', 'cancelled_late')) = (cancelled_at IS NOT NULL)`,
    ),
    check('bookings_web_has_consent', sql`source <> 'web' OR consent_id IS NOT NULL`),
    check('bookings_web_has_idempotency', sql`source <> 'web' OR idempotency_key IS NOT NULL`),
    check(
      'bookings_deleted_inactive',
      sql`deleted_at IS NULL OR status NOT IN ('confirmed', 'arrived', 'in_progress')`,
    ),
    // Unique among *active* bookings only, so a cancelled slot can be re-booked (G-03).
    uniqueIndex('bookings_idempotency_active_uidx')
      .on(sql`idempotency_key`)
      .where(sql`idempotency_key IS NOT NULL AND status IN ('confirmed', 'arrived', 'in_progress')`),
    index('bookings_start_idx').on(sql`lower(during)`),
    index('bookings_customer_idx').on(sql`customer_id`, sql`lower(during) DESC`),
    index('bookings_unack_idx').on(sql`created_at DESC`).where(sql`acknowledged_at IS NULL`),
  ],
)

// ---------------------------------------------------------------- time blocks
export const timeBlocks = pgTable(
  'time_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceId: smallint('resource_id').notNull().default(1),
    during: tstzrange('during').notNull(),
    kind: blockKind('kind').notNull(),
    label: text('label'),
    /** B7: generated from a weekly rule (one row per day; a deleted day stays deleted). */
    recurringId: uuid('recurring_id').references((): AnyPgColumn => recurringBlocks.id),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
    deletedAt: tz('deleted_at'),
  },
  () => [
    check('time_blocks_label_len', sql`char_length(label) <= 50`),
    uniqueIndex('time_blocks_recurring_day_uidx')
      .on(sql`recurring_id`, sql`lower(during)`)
      .where(sql`recurring_id IS NOT NULL`),
    check(
      'time_blocks_during_half_open',
      sql`lower_inc(during) AND NOT upper_inc(during) AND NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during)`,
    ),
    check('time_blocks_max_span', sql`upper(during) - lower(during) <= interval '60 days'`),
    index('time_blocks_during_gist').using('gist', sql`resource_id`, sql`during`).where(sql`deleted_at IS NULL`),
  ],
)

/**
 * B7 毎週の休憩 (2026-10-18): "every Tue–Sun 21:00–21:30". Materialized into time_blocks for the
 * bookable horizon (on save and nightly), so the availability SQL and the EXCLUDE model stay
 * untouched. weekday_mask: bit n = weekday n (0 = Sunday, as business_hours).
 */
export const recurringBlocks = pgTable(
  'recurring_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weekdayMask: smallint('weekday_mask').notNull(),
    startMin: smallint('start_min').notNull(),
    endMin: smallint('end_min').notNull(),
    kind: blockKind('kind').notNull(),
    label: text('label'),
    createdAt: tz('created_at').notNull().defaultNow(),
    deletedAt: tz('deleted_at'),
  },
  () => [
    check('recurring_blocks_mask', sql`weekday_mask BETWEEN 1 AND 127`),
    check(
      'recurring_blocks_range',
      sql`start_min BETWEEN 0 AND 1439 AND end_min BETWEEN 1 AND 1440 AND end_min > start_min`,
    ),
    check('recurring_blocks_label_len', sql`char_length(label) <= 50`),
  ],
)

// ---------------------------------------------------------------- push / notifications
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => authSession.id, { onDelete: 'set null' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    platform: pushPlatform('platform').notNull().default('other'),
    userAgent: text('user_agent'),
    lastSeenAt: tz('last_seen_at').notNull().defaultNow(),
    lastSuccessAt: tz('last_success_at'),
    failCount: integer('fail_count').notNull().default(0),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  () => [
    check('push_subscriptions_endpoint_https', sql`endpoint ~ '^https://'`),
    check('push_subscriptions_user_agent_len', sql`char_length(user_agent) <= 512`),
    check('push_subscriptions_fail_count_nonneg', sql`fail_count >= 0`),
  ],
)

export const notificationLog = pgTable(
  'notification_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    subscriptionId: uuid('subscription_id').references(() => pushSubscriptions.id, {
      onDelete: 'set null',
    }),
    channel: text('channel').notNull().default('push'),
    template: text('template').notNull(),
    scheduledFor: tz('scheduled_for').notNull(),
    sentAt: tz('sent_at'),
    status: notificationStatus('status').notNull(),
    httpStatus: smallint('http_status'),
    /** Never contains PII. */
    error: text('error'),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  () => [
    check('notification_log_channel', sql`channel IN ('push')`),
    check(
      'notification_log_template',
      sql`template IN ('booking_created', 'booking_cancelled', 'daily_digest', 'test')`,
    ),
    check('notification_log_error_len', sql`char_length(error) <= 500`),
    index('notification_log_booking_idx').on(sql`booking_id`),
  ],
)

// ---------------------------------------------------------------- audit / rate limits / digests
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    /** Polymorphic reference, no FK. */
    entityId: text('entity_id').notNull(),
    /** Allow-listed fields only: never names, phone numbers or notes (08_security.md §9). */
    diff: jsonb('diff').notNull().default(sql`'{}'::jsonb`),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  () => [
    check('audit_log_actor', sql`actor ~ '^(owner|system|customer:[0-9a-f-]{36})$'`),
    check('audit_log_action', sql`action ~ '^[a-z_]+\\.[a-z_]+$'`),
    check(
      'audit_log_entity_type',
      sql`entity_type IN ('booking', 'customer', 'time_block', 'menu', 'business_hours', 'override', 'settings', 'push_subscription', 'session', 'karte')`,
    ),
    index('audit_log_entity_idx').on(sql`entity_type`, sql`entity_id`, sql`created_at DESC`),
  ],
)

export const rateLimits = pgTable(
  'rate_limits',
  {
    /** e.g. book:ip:<hmac>, book:phone:<hmac> */
    key: text('key').notNull(),
    windowStart: tz('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    check('rate_limits_key_len', sql`char_length(key) <= 128`),
    index('rate_limits_window_idx').on(sql`window_start`),
  ],
)

// ---------------------------------------------------------------- karte (B3, 2026-10-18)
/**
 * One record per visit: the owner's treatment notes ("ツーブロック 6mm …"). PII-bearing: deleted
 * on anonymization, included in the customer export, never written to logs or audit diffs.
 */
export const karteRecords = pgTable(
  'karte_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    body: text('body'),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  () => [
    check('karte_records_body_len', sql`char_length(body) <= 2000`),
    uniqueIndex('karte_records_booking_uidx').on(sql`booking_id`).where(sql`booking_id IS NOT NULL`),
    index('karte_records_customer_idx').on(sql`customer_id`, sql`created_at DESC`),
  ],
)

/**
 * Photos of a visit, stored in Postgres (owner decision 2026-10-18: no extra storage service).
 * The browser shrinks them to a JPEG of at most 1280 px (~150 KB) before upload; the row cap is
 * 600 KB. Taken only after the customer agreed (consents.kind = 'photo_karte').
 */
export const kartePhotos = pgTable(
  'karte_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    karteId: uuid('karte_id')
      .notNull()
      .references(() => karteRecords.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    consentId: uuid('consent_id')
      .notNull()
      .references(() => consents.id),
    contentType: text('content_type').notNull(),
    data: bytea('data').notNull(),
    width: smallint('width').notNull(),
    height: smallint('height').notNull(),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  () => [
    check('karte_photos_content_type', sql`content_type = 'image/jpeg'`),
    check('karte_photos_size', sql`octet_length(data) BETWEEN 100 AND 614400`),
    check('karte_photos_dims', sql`width BETWEEN 1 AND 4096 AND height BETWEEN 1 AND 4096`),
    index('karte_photos_karte_idx').on(sql`karte_id`, sql`created_at`),
    index('karte_photos_customer_idx').on(sql`customer_id`),
  ],
)

export const dailyDigests = pgTable('daily_digests', {
  /** JST date the digest was sent; PK prevents a second send on the same day. */
  digestSentOn: date('digest_sent_on', { mode: 'string' }).primaryKey(),
  targetDate: date('target_date', { mode: 'string' }).notNull(),
  bookingCount: integer('booking_count').notNull(),
  sentAt: tz('sent_at').notNull().defaultNow(),
})
