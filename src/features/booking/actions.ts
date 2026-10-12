'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import type { ActionResult } from '@/lib/action-result'
import { clientIp } from '@/lib/client-ip'
import { notifyOwner } from '@/lib/notify'
import { formToObject } from './schema'
import { cancelByToken, submitBooking } from './service'

/*
 * Thin Server Actions (API-01). Exported actions are reachable by direct POST, so every
 * check lives in the service, not in the UI. Next.js already enforces POST + Origin/Host.
 */

export type CreateBookingState = ActionResult<{ doneUrl: string }> | null
export type CancelBookingState = ActionResult<null> | null

export async function createBooking(_prev: CreateBookingState, form: FormData): Promise<CreateBookingState> {
  const h = await headers()
  const { result, createdBookingId } = await submitBooking(formToObject(form), {
    ip: clientIp(h),
    userAgent: h.get('user-agent'),
  })
  // Owner push after the response; never affects the booking result (FR-S-03).
  if (createdBookingId) after(() => notifyOwner('booking_created', createdBookingId))
  return result
}

export async function cancelBooking(_prev: CancelBookingState, form: FormData): Promise<CancelBookingState> {
  const { result, cancelledBookingId } = await cancelByToken(formToObject(form), {})
  if (cancelledBookingId) after(() => notifyOwner('booking_cancelled', cancelledBookingId))
  return result
}
