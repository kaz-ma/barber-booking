CREATE TABLE "recurring_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekday_mask" smallint NOT NULL,
	"start_min" smallint NOT NULL,
	"end_min" smallint NOT NULL,
	"kind" "block_kind" NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "recurring_blocks_mask" CHECK (weekday_mask BETWEEN 1 AND 127),
	CONSTRAINT "recurring_blocks_range" CHECK (start_min BETWEEN 0 AND 1439 AND end_min BETWEEN 1 AND 1440 AND end_min > start_min),
	CONSTRAINT "recurring_blocks_label_len" CHECK (char_length(label) <= 50)
);
--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "recurring_id" uuid;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_recurring_id_recurring_blocks_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "time_blocks_recurring_day_uidx" ON "time_blocks" USING btree (recurring_id,lower(during)) WHERE recurring_id IS NOT NULL;