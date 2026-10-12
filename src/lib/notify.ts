import 'server-only'
import { logger } from '@/lib/logger'

export type OwnerNotification = 'booking_created' | 'booking_cancelled'

/**
 * Owner push hook, called from `after()` so it never affects the booking result (FR-S-03).
 * TODO(push slice): send the Declarative Web Push payload via web-push to all
 * push_subscriptions, record notification_log, delete 404/410 subscriptions (ADR-0007).
 */
export async function notifyOwner(kind: OwnerNotification, bookingId: string): Promise<void> {
  logger.info('notify_owner.stub', { kind, bookingId })
}
