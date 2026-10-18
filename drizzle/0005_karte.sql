CREATE TABLE "karte_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"karte_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"consent_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"width" smallint NOT NULL,
	"height" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "karte_photos_content_type" CHECK (content_type = 'image/jpeg'),
	CONSTRAINT "karte_photos_size" CHECK (octet_length(data) BETWEEN 100 AND 614400),
	CONSTRAINT "karte_photos_dims" CHECK (width BETWEEN 1 AND 4096 AND height BETWEEN 1 AND 4096)
);
--> statement-breakpoint
CREATE TABLE "karte_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"booking_id" uuid,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "karte_records_body_len" CHECK (char_length(body) <= 2000)
);
--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "customers_anonymized_clean";--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "instagram_handle" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "karte_photos" ADD CONSTRAINT "karte_photos_karte_id_karte_records_id_fk" FOREIGN KEY ("karte_id") REFERENCES "public"."karte_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karte_photos" ADD CONSTRAINT "karte_photos_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karte_photos" ADD CONSTRAINT "karte_photos_consent_id_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karte_records" ADD CONSTRAINT "karte_records_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karte_records" ADD CONSTRAINT "karte_records_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "karte_photos_karte_idx" ON "karte_photos" USING btree (karte_id,created_at);--> statement-breakpoint
CREATE INDEX "karte_photos_customer_idx" ON "karte_photos" USING btree (customer_id);--> statement-breakpoint
CREATE UNIQUE INDEX "karte_records_booking_uidx" ON "karte_records" USING btree (booking_id) WHERE booking_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "karte_records_customer_idx" ON "karte_records" USING btree (customer_id,created_at DESC);--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_instagram_handle_format" CHECK (instagram_handle IS NULL OR instagram_handle ~ '^[A-Za-z0-9._]{1,30}$');--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_anonymized_clean" CHECK (anonymized_at IS NULL OR (name IS NULL AND name_kana IS NULL AND phone_e164 IS NULL AND phone_display IS NULL AND line_user_id IS NULL AND instagram_user_id IS NULL AND instagram_handle IS NULL));