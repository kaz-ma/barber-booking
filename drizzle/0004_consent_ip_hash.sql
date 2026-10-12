-- Custom migration (SR-15, AGENTS.md rule 5): consents keep an HMAC of the client IP
-- (HMAC-SHA256(PII_HASH_SECRET, ip), base64url 22 chars, the same scheme as rate_limits keys),
-- never the raw address. The HMAC needs the application secret, so existing raw values cannot
-- be converted in SQL; they are dropped (pre-launch data only; the 1-year purge would null
-- them anyway). The partial index consents_pii_purge_idx follows the renamed column.
ALTER TABLE "consents" RENAME COLUMN "ip" TO "ip_hash";
--> statement-breakpoint
ALTER TABLE "consents" ALTER COLUMN "ip_hash" SET DATA TYPE text USING NULL;
--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_ip_hash_len" CHECK (char_length(ip_hash) <= 32);
