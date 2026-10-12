import 'server-only'
import { sql } from 'drizzle-orm'
import { audit } from '@/lib/audit'
import { db } from '@/lib/db'
import { piiHmac } from '@/lib/hash'

/*
 * Retention job (FR-S-09, Should; 04_data_model.md §8): customers whose last visit is more than
 * 3 years ago and who have no future active booking are anonymized. One transaction per run;
 * the customers_anonymized_clean CHECK prevents partial results.
 */
export async function runRetention(now: Date = new Date()): Promise<{ anonymized: number }> {
  return db.transaction(async (tx) => {
    const t = now.toISOString()
    const targets = await tx.execute<{ id: string; phone_e164: string | null }>(sql`
      SELECT c.id, c.phone_e164 FROM customers c
      WHERE c.anonymized_at IS NULL AND c.last_visit_at < ${t}::timestamptz - interval '3 years'
        AND NOT EXISTS (
          SELECT 1 FROM bookings b WHERE b.customer_id = c.id
            AND b.status IN ('confirmed', 'arrived', 'in_progress') AND lower(b.during) > ${t}::timestamptz)
      FOR UPDATE
    `)
    for (const c of targets.rows) {
      const hash = c.phone_e164 ? Buffer.from(piiHmac(c.phone_e164), 'base64url') : null
      await tx.execute(sql`
        UPDATE customers SET name = NULL, name_kana = NULL, phone_e164 = NULL, phone_display = NULL,
               line_user_id = NULL, instagram_user_id = NULL, phone_hash = ${hash}, anonymized_at = ${t}::timestamptz
        WHERE id = ${c.id}`)
      await tx.execute(sql`UPDATE bookings SET note = NULL, owner_note = NULL WHERE customer_id = ${c.id}`)
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
}
