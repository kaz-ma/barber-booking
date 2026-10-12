import 'server-only'
import { sql } from 'drizzle-orm'
import { audit } from '@/lib/audit'
import { db } from '@/lib/db'
import { piiHmac } from '@/lib/hash'
import { logger } from '@/lib/logger'
import { errorFields } from '@/lib/pg-errors'

/*
 * Retention job (FR-S-09, 10.3; 04_data_model.md §8), Vercel Cron 03:00 JST daily.
 *
 * Anonymization: a customer whose last activity is more than 3 years ago and who has no future
 * active booking. "Last activity" = GREATEST(last_visit_at, end of the latest booking of any
 * status, created_at) (SR-06 / CR-04): last_visit_at alone is only set by the `completed`
 * transition, so customers who only cancelled, no-showed, or whose visits were never marked
 * completed would otherwise keep their PII forever. One transaction per run; the
 * customers_anonymized_clean CHECK prevents partial results.
 *
 * Free-text cancel reasons are cleared too; the fixed markers 'deleted' / 'anonymized' stay (CR-20).
 *
 * Housekeeping of append-only tables runs here too (SR-15: it used to piggy-back on the daily
 * digest, where a push failure skipped it); its failure never fails the anonymization.
 */

export async function runRetention(now: Date = new Date()): Promise<{ anonymized: number }> {
  const t = now.toISOString()
  const result = await db.transaction(async (tx) => {
    const targets = await tx.execute<{ id: string; phone_e164: string | null }>(sql`
      SELECT c.id, c.phone_e164 FROM customers c
      WHERE c.anonymized_at IS NULL
        AND GREATEST(
              c.last_visit_at,
              c.created_at,
              (SELECT max(upper(b.during)) FROM bookings b WHERE b.customer_id = c.id)
            ) < ${t}::timestamptz - interval '3 years'
        AND NOT EXISTS (
          SELECT 1 FROM bookings b WHERE b.customer_id = c.id
            AND b.status IN ('confirmed', 'arrived', 'in_progress') AND lower(b.during) > ${t}::timestamptz)
      FOR UPDATE OF c
    `)
    for (const c of targets.rows) {
      const hash = c.phone_e164 ? Buffer.from(piiHmac(c.phone_e164), 'base64url') : null
      await tx.execute(sql`
        UPDATE customers SET name = NULL, name_kana = NULL, phone_e164 = NULL, phone_display = NULL,
               line_user_id = NULL, instagram_user_id = NULL, phone_hash = ${hash}, anonymized_at = ${t}::timestamptz
        WHERE id = ${c.id}`)
      await tx.execute(sql`
        UPDATE bookings SET note = NULL, owner_note = NULL, cancel_token_hash = NULL,
               cancel_reason = CASE WHEN cancel_reason IN ('deleted', 'anonymized') THEN cancel_reason END
        WHERE customer_id = ${c.id}`)
      await tx.execute(sql`UPDATE consents SET ip_hash = NULL, user_agent = NULL WHERE customer_id = ${c.id}`)
    }
    if (targets.rows.length > 0) {
      await audit(tx, {
        actor: 'system',
        action: 'customer.anonymize',
        entityType: 'customer',
        entityId: 'retention',
        diff: { count: targets.rows.length },
      })
    }
    return { anonymized: targets.rows.length }
  })
  await runHousekeeping(now)
  return result
}

/** 04_data_model.md §8 retention for append-only tables. Logged, never thrown. */
export async function runHousekeeping(now: Date = new Date()): Promise<void> {
  try {
    const t = now.toISOString()
    await db.execute(sql`DELETE FROM rate_limits WHERE window_start < ${t}::timestamptz - interval '2 days'`)
    await db.execute(sql`
      UPDATE consents SET ip_hash = NULL, user_agent = NULL
      WHERE accepted_at < ${t}::timestamptz - interval '1 year' AND (ip_hash IS NOT NULL OR user_agent IS NOT NULL)`)
    await db.execute(sql`DELETE FROM notification_log WHERE created_at < ${t}::timestamptz - interval '1 year'`)
    await db.execute(sql`DELETE FROM auth_verification WHERE expires_at < ${t}::timestamptz - interval '1 day'`)
  } catch (err) {
    logger.error('retention.housekeeping_failed', errorFields(err))
  }
}
