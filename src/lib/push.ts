import 'server-only'
import { eq, inArray, sql } from 'drizzle-orm'
import webpush from 'web-push'
import { db } from '@/lib/db'
import { notificationLog, pushSubscriptions } from '@/lib/db/schema'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import type { DeclarativePushPayload } from '@/lib/push-payload'

/*
 * Web Push sender (FR-S-03, ADR-0007, 05_state_and_flows.md §6-7). Best-effort:
 *   - every subscription in parallel with Promise.allSettled, TTL 6 h, timeout 8 s, topic;
 *   - 201 -> last_success_at, fail_count = 0; 404 / 410 -> subscription deleted;
 *     429 / 5xx / network -> fail_count + 1, no retry;
 *   - one notification_log row per attempt. `error` holds only a status / error class, never
 *     the endpoint or the payload.
 * VAPID keys are fixed (never rotate). Without them (local dev) nothing is sent.
 */

export type PushTemplate = 'booking_created' | 'booking_cancelled' | 'daily_digest' | 'test'

export type PushSendOptions = {
  template: PushTemplate
  bookingId?: string | null
  /** Origin time of the notification (booking created / cancelled), for KPI-07. */
  scheduledFor: Date
  urgency: 'high' | 'normal'
  topic: string
  now?: Date
}

export type PushSendResult = {
  subscriptionId: string
  platform: string
  httpStatus: number | null
  status: 'sent' | 'failed' | 'expired'
  error?: string
}

export const PUSH_TTL_SEC = 21_600
export const PUSH_TIMEOUT_MS = 8_000

export function isPushConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT)
}

function statusCodeOf(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const code = (err as { statusCode?: unknown }).statusCode
    return typeof code === 'number' ? code : null
  }
  return null
}

function errorLabel(err: unknown, httpStatus: number | null): string {
  const name = err instanceof Error ? err.name : 'Error'
  return (httpStatus ? `${name} ${httpStatus}` : name).slice(0, 100)
}

export async function sendPushToAll(payload: DeclarativePushPayload, opts: PushSendOptions): Promise<PushSendResult[]> {
  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      platform: pushSubscriptions.platform,
    })
    .from(pushSubscriptions)
  if (subs.length === 0) return []
  if (!isPushConfigured()) {
    logger.warn('push.skipped', { reason: 'VAPID keys unset', template: opts.template })
    return []
  }

  const body = JSON.stringify(payload)
  const vapidDetails = {
    subject: env.VAPID_SUBJECT as string,
    publicKey: env.VAPID_PUBLIC_KEY as string,
    privateKey: env.VAPID_PRIVATE_KEY as string,
  }
  const settled = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
        TTL: PUSH_TTL_SEC,
        urgency: opts.urgency,
        topic: opts.topic,
        timeout: PUSH_TIMEOUT_MS,
        vapidDetails,
      }),
    ),
  )

  const now = opts.now ?? new Date()
  const results: PushSendResult[] = settled.map((r, i) => {
    const sub = subs[i] as (typeof subs)[number]
    if (r.status === 'fulfilled') {
      return { subscriptionId: sub.id, platform: sub.platform, httpStatus: r.value.statusCode, status: 'sent' }
    }
    const httpStatus = statusCodeOf(r.reason)
    const expired = httpStatus === 404 || httpStatus === 410
    return {
      subscriptionId: sub.id,
      platform: sub.platform,
      httpStatus,
      status: expired ? 'expired' : 'failed',
      error: errorLabel(r.reason, httpStatus),
    }
  })

  await db.insert(notificationLog).values(
    results.map((r) => ({
      bookingId: opts.bookingId ?? null,
      subscriptionId: r.subscriptionId,
      template: opts.template,
      scheduledFor: opts.scheduledFor,
      sentAt: r.status === 'sent' ? now : null,
      status: r.status,
      httpStatus: r.httpStatus,
      error: r.error ?? null,
    })),
  )

  const sentIds = results.filter((r) => r.status === 'sent').map((r) => r.subscriptionId)
  const failedIds = results.filter((r) => r.status === 'failed').map((r) => r.subscriptionId)
  const expiredIds = results.filter((r) => r.status === 'expired').map((r) => r.subscriptionId)
  if (sentIds.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ lastSuccessAt: now, failCount: 0 })
      .where(inArray(pushSubscriptions.id, sentIds))
  }
  if (failedIds.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ failCount: sql`${pushSubscriptions.failCount} + 1` })
      .where(inArray(pushSubscriptions.id, failedIds))
  }
  for (const id of expiredIds) {
    // notification_log.subscription_id is ON DELETE SET NULL, so the log row survives.
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id))
  }

  logger.info('push.sent', {
    template: opts.template,
    bookingId: opts.bookingId ?? null,
    sent: sentIds.length,
    failed: failedIds.length,
    expired: expiredIds.length,
  })
  return results
}
