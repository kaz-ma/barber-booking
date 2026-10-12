CREATE TYPE "public"."block_kind" AS ENUM('break', 'private', 'closed', 'holiday');--> statement-breakpoint
CREATE TYPE "public"."booking_restriction" AS ENUM('none', 'dm_only', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."booking_source" AS ENUM('web', 'phone', 'walk_in', 'instagram', 'line', 'manual');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'arrived', 'in_progress', 'completed', 'cancelled_by_customer', 'cancelled_by_owner', 'cancelled_late', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."consent_kind" AS ENUM('booking_policy', 'privacy', 'health_notes', 'photo_karte', 'photo_sns', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."locale_code" AS ENUM('ja', 'en');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('sent', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."occupation" AS ENUM('student', 'worker');--> statement-breakpoint
CREATE TYPE "public"."push_platform" AS ENUM('ios', 'android', 'desktop', 'other');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_actor" CHECK (actor ~ '^(owner|system|customer:[0-9a-f-]{36})$'),
	CONSTRAINT "audit_log_action" CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
	CONSTRAINT "audit_log_entity_type" CHECK (entity_type IN ('booking', 'customer', 'time_block', 'menu', 'business_hours', 'override', 'settings', 'push_subscription', 'session'))
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text NOT NULL,
	"resource_id" smallint DEFAULT 1 NOT NULL,
	"customer_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	"during" "tstzrange" NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"source" "booking_source" NOT NULL,
	"locale" "locale_code" DEFAULT 'ja' NOT NULL,
	"price_jpy" integer NOT NULL,
	"is_student" boolean DEFAULT false NOT NULL,
	"buffer_min" smallint DEFAULT 0 NOT NULL,
	"note" text,
	"owner_note" text,
	"idempotency_key" text,
	"submission_nonce_hash" "bytea",
	"cancel_token_hash" "bytea",
	"cancel_token_expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"consent_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"late_minutes" smallint,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "bookings_public_code_unique" UNIQUE("public_code"),
	CONSTRAINT "bookings_cancel_token_hash_unique" UNIQUE("cancel_token_hash"),
	CONSTRAINT "bookings_public_code_format" CHECK (public_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
	CONSTRAINT "bookings_resource_id_positive" CHECK (resource_id >= 1),
	CONSTRAINT "bookings_price_nonneg" CHECK (price_jpy >= 0),
	CONSTRAINT "bookings_buffer_nonneg" CHECK (buffer_min >= 0),
	CONSTRAINT "bookings_note_len" CHECK (char_length(note) <= 500),
	CONSTRAINT "bookings_owner_note_len" CHECK (char_length(owner_note) <= 500),
	CONSTRAINT "bookings_idempotency_key_format" CHECK (idempotency_key IS NULL OR idempotency_key ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "bookings_cancel_token_hash_len" CHECK (cancel_token_hash IS NULL OR octet_length(cancel_token_hash) = 32),
	CONSTRAINT "bookings_cancel_reason_len" CHECK (char_length(cancel_reason) <= 200),
	CONSTRAINT "bookings_late_minutes_nonneg" CHECK (late_minutes >= 0),
	CONSTRAINT "bookings_during_half_open" CHECK (lower_inc(during) AND NOT upper_inc(during) AND NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during)),
	CONSTRAINT "bookings_cancel_consistency" CHECK ((status IN ('cancelled_by_customer', 'cancelled_by_owner', 'cancelled_late')) = (cancelled_at IS NOT NULL)),
	CONSTRAINT "bookings_web_has_consent" CHECK (source <> 'web' OR consent_id IS NOT NULL),
	CONSTRAINT "bookings_web_has_idempotency" CHECK (source <> 'web' OR idempotency_key IS NOT NULL),
	CONSTRAINT "bookings_deleted_inactive" CHECK (deleted_at IS NULL OR status NOT IN ('confirmed', 'arrived', 'in_progress'))
);
--> statement-breakpoint
CREATE TABLE "business_hour_overrides" (
	"date" date PRIMARY KEY NOT NULL,
	"is_closed" boolean DEFAULT true NOT NULL,
	"open_min" smallint,
	"close_min" smallint,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overrides_open_range" CHECK (open_min BETWEEN 0 AND 1440),
	CONSTRAINT "overrides_close_range" CHECK (close_min BETWEEN 0 AND 1440),
	CONSTRAINT "overrides_reason_len" CHECK (char_length(reason) <= 100),
	CONSTRAINT "overrides_valid" CHECK (is_closed OR (open_min IS NOT NULL AND close_min IS NOT NULL AND open_min < close_min))
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"weekday" smallint PRIMARY KEY NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"open_min" smallint,
	"close_min" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_hours_weekday_range" CHECK (weekday BETWEEN 0 AND 6),
	CONSTRAINT "business_hours_open_range" CHECK (open_min BETWEEN 0 AND 1440),
	CONSTRAINT "business_hours_close_range" CHECK (close_min BETWEEN 0 AND 1440),
	CONSTRAINT "business_hours_valid" CHECK (is_closed OR (open_min IS NOT NULL AND close_min IS NOT NULL AND open_min < close_min))
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"booking_id" uuid,
	"kind" "consent_kind" NOT NULL,
	"policy_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consents_policy_version_len" CHECK (char_length(policy_version) <= 32),
	CONSTRAINT "consents_user_agent_len" CHECK (char_length(user_agent) <= 512)
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"name_kana" text,
	"phone_e164" text,
	"phone_display" text,
	"phone_unverified" boolean DEFAULT false NOT NULL,
	"phone_hash" "bytea",
	"occupation" "occupation",
	"locale" "locale_code" DEFAULT 'ja' NOT NULL,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"late_cancel_count" integer DEFAULT 0 NOT NULL,
	"booking_restriction" "booking_restriction" DEFAULT 'none' NOT NULL,
	"merged_into_customer_id" uuid,
	"line_user_id" text,
	"instagram_user_id" text,
	"last_visit_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "customers_line_user_id_unique" UNIQUE("line_user_id"),
	CONSTRAINT "customers_instagram_user_id_unique" UNIQUE("instagram_user_id"),
	CONSTRAINT "customers_name_len" CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 50),
	CONSTRAINT "customers_name_kana_len" CHECK (name_kana IS NULL OR char_length(name_kana) <= 50),
	CONSTRAINT "customers_phone_e164_format" CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "customers_phone_display_len" CHECK (phone_display IS NULL OR char_length(phone_display) <= 32),
	CONSTRAINT "customers_no_show_count_nonneg" CHECK (no_show_count >= 0),
	CONSTRAINT "customers_late_cancel_count_nonneg" CHECK (late_cancel_count >= 0),
	CONSTRAINT "customers_name_present" CHECK (anonymized_at IS NOT NULL OR name IS NOT NULL),
	CONSTRAINT "customers_anonymized_clean" CHECK (anonymized_at IS NULL OR (name IS NULL AND name_kana IS NULL AND phone_e164 IS NULL AND phone_display IS NULL AND line_user_id IS NULL AND instagram_user_id IS NULL)),
	CONSTRAINT "customers_not_self_merged" CHECK (merged_into_customer_id IS DISTINCT FROM id)
);
--> statement-breakpoint
CREATE TABLE "daily_digests" (
	"digest_sent_on" date PRIMARY KEY NOT NULL,
	"target_date" date NOT NULL,
	"booking_count" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_ja" text NOT NULL,
	"name_en" text NOT NULL,
	"description_ja" text,
	"description_en" text,
	"price_jpy" integer NOT NULL,
	"price_student_jpy" integer,
	"duration_min" smallint NOT NULL,
	"buffer_after_min" smallint DEFAULT 0 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menus_slug_unique" UNIQUE("slug"),
	CONSTRAINT "menus_slug_format" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "menus_name_ja_len" CHECK (char_length(name_ja) BETWEEN 1 AND 40),
	CONSTRAINT "menus_name_en_len" CHECK (char_length(name_en) BETWEEN 1 AND 60),
	CONSTRAINT "menus_description_ja_len" CHECK (char_length(description_ja) <= 120),
	CONSTRAINT "menus_description_en_len" CHECK (char_length(description_en) <= 200),
	CONSTRAINT "menus_price_nonneg" CHECK (price_jpy >= 0),
	CONSTRAINT "menus_price_student_range" CHECK (price_student_jpy IS NULL OR price_student_jpy BETWEEN 0 AND price_jpy),
	CONSTRAINT "menus_duration_valid" CHECK (duration_min BETWEEN 15 AND 480 AND duration_min % 5 = 0),
	CONSTRAINT "menus_buffer_valid" CHECK (buffer_after_min BETWEEN 0 AND 120 AND buffer_after_min % 5 = 0)
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"booking_id" uuid,
	"subscription_id" uuid,
	"channel" text DEFAULT 'push' NOT NULL,
	"template" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"status" "notification_status" NOT NULL,
	"http_status" smallint,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_channel" CHECK (channel IN ('push')),
	CONSTRAINT "notification_log_template" CHECK (template IN ('booking_created', 'booking_cancelled', 'daily_digest', 'test')),
	CONSTRAINT "notification_log_error_len" CHECK (char_length(error) <= 500)
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"platform" "push_platform" DEFAULT 'other' NOT NULL,
	"user_agent" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint"),
	CONSTRAINT "push_subscriptions_endpoint_https" CHECK (endpoint ~ '^https://'),
	CONSTRAINT "push_subscriptions_user_agent_len" CHECK (char_length(user_agent) <= 512),
	CONSTRAINT "push_subscriptions_fail_count_nonneg" CHECK (fail_count >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start"),
	CONSTRAINT "rate_limits_key_len" CHECK (char_length(key) <= 128)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"slot_step_min" smallint DEFAULT 30 NOT NULL,
	"lead_time_min" smallint DEFAULT 60 NOT NULL,
	"max_advance_days" smallint DEFAULT 60 NOT NULL,
	"cancel_deadline_min" smallint DEFAULT 120 NOT NULL,
	"timezone" text DEFAULT 'Asia/Tokyo' NOT NULL,
	"allow_same_day" boolean DEFAULT true NOT NULL,
	"digest_hour_jst" smallint DEFAULT 21 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row" CHECK (id = 1),
	CONSTRAINT "settings_slot_step" CHECK (slot_step_min IN (10, 15, 20, 30, 60)),
	CONSTRAINT "settings_lead_time" CHECK (lead_time_min BETWEEN 0 AND 2880),
	CONSTRAINT "settings_max_advance" CHECK (max_advance_days BETWEEN 1 AND 365),
	CONSTRAINT "settings_cancel_deadline" CHECK (cancel_deadline_min BETWEEN 0 AND 10080),
	CONSTRAINT "settings_timezone" CHECK (timezone = 'Asia/Tokyo'),
	CONSTRAINT "settings_digest_hour" CHECK (digest_hour_jst BETWEEN 0 AND 23)
);
--> statement-breakpoint
CREATE TABLE "time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" smallint DEFAULT 1 NOT NULL,
	"during" "tstzrange" NOT NULL,
	"kind" "block_kind" NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "time_blocks_label_len" CHECK (char_length(label) <= 50),
	CONSTRAINT "time_blocks_during_half_open" CHECK (lower_inc(during) AND NOT upper_inc(during) AND NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during)),
	CONSTRAINT "time_blocks_max_span" CHECK (upper(during) - lower(during) <= interval '60 days')
);
--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"aaguid" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_merged_into_customer_id_customers_id_fk" FOREIGN KEY ("merged_into_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_session_id_auth_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_passkey" ADD CONSTRAINT "auth_passkey_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree (entity_type,entity_id,created_at DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_idempotency_active_uidx" ON "bookings" USING btree (idempotency_key) WHERE idempotency_key IS NOT NULL AND status IN ('confirmed', 'arrived', 'in_progress');--> statement-breakpoint
CREATE INDEX "bookings_start_idx" ON "bookings" USING btree (lower(during));--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree (customer_id,lower(during) DESC);--> statement-breakpoint
CREATE INDEX "bookings_unack_idx" ON "bookings" USING btree (created_at DESC) WHERE acknowledged_at IS NULL;--> statement-breakpoint
CREATE INDEX "consents_customer_idx" ON "consents" USING btree (customer_id,accepted_at DESC);--> statement-breakpoint
CREATE INDEX "consents_pii_purge_idx" ON "consents" USING btree (accepted_at) WHERE ip IS NOT NULL OR user_agent IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_e164_uidx" ON "customers" USING btree (phone_e164) WHERE phone_e164 IS NOT NULL AND deleted_at IS NULL AND merged_into_customer_id IS NULL;--> statement-breakpoint
CREATE INDEX "customers_name_kana_trgm_idx" ON "customers" USING gin (name_kana gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customers_retention_idx" ON "customers" USING btree (last_visit_at) WHERE anonymized_at IS NULL;--> statement-breakpoint
CREATE INDEX "notification_log_booking_idx" ON "notification_log" USING btree (booking_id);--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree (window_start);--> statement-breakpoint
CREATE INDEX "time_blocks_during_gist" ON "time_blocks" USING gist (resource_id,during) WHERE deleted_at IS NULL;