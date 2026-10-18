import 'server-only'
import type { DbOrTx } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'

type AuditEntity =
  | 'booking'
  | 'customer'
  | 'time_block'
  | 'menu'
  | 'business_hours'
  | 'override'
  | 'settings'
  | 'push_subscription'
  | 'session'
  | 'karte'

/** Diff values are allow-listed scalars; never names, phone numbers or free text (§9). */
type AuditDiff = Record<string, string | number | boolean | null>

export async function audit(
  db: DbOrTx,
  entry: {
    actor: 'owner' | 'system' | `customer:${string}`
    action: `${string}.${string}`
    entityType: AuditEntity
    entityId: string
    diff?: AuditDiff
  },
): Promise<void> {
  await db.insert(auditLog).values({
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    diff: entry.diff ?? {},
  })
}
