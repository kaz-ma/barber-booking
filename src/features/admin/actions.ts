'use server'

import { refresh, updateTag } from 'next/cache'
import { headers } from 'next/headers'
import type { ActionResult } from '@/lib/action-result'
import { invalid } from '@/lib/action-result'
import { clientIp } from '@/lib/client-ip'
import { requireAdmin } from './auth'
import {
  anonymizeSchema,
  blockIdSchema,
  bookingIdSchema,
  businessHoursSchema,
  createManualBookingSchema,
  createTimeBlockSchema,
  customerIdSchema,
  dateSchema,
  endpointSchema,
  hourOverrideSchema,
  idsSchema,
  moveMenuSchema,
  otpCodeSchema,
  ownerNoteSchema,
  pushSubscriptionSchema,
  reissueSchema,
  restrictionSchema,
  setMenuActiveSchema,
  settingsSchema,
  subscriptionIdSchema,
  undoSchema,
  updateBookingStatusSchema,
  upsertMenuSchema,
} from './schema'
import * as service from './service'
import type { AdminResult } from './types'

/*
 * Thin admin Server Actions (06_api.md §3, API-04): requireAdmin() -> Zod -> service.
 * Every export is reachable by a direct POST, so nothing here trusts the UI; a request without
 * a valid session gets `unauthorized` (AT-27). Cache: menus / hours / settings use updateTag,
 * calendar changes call refresh() so the client router re-renders (API-08).
 */

const UNAUTHORIZED = { status: 'unauthorized' } as const

async function sessionCtx(): Promise<service.SessionCtx | null> {
  const session = await requireAdmin()
  if (!session) return null
  const h = await headers()
  return { userId: session.user.id, sessionId: session.session.id, userAgent: h.get('user-agent') }
}

// ---------------------------------------------------------------- login fallback (before auth)

export async function requestAdminOtpAction(): Promise<ActionResult<null>> {
  const h = await headers()
  return service.requestAdminOtp({ ip: clientIp(h), headers: h })
}

export async function verifyAdminOtpAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = otpCodeSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const h = await headers()
  return service.verifyAdminOtp(parsed.data, { ip: clientIp(h), headers: h })
}

// ---------------------------------------------------------------- bookings

export async function createManualBookingAction(input: unknown): Promise<AdminResult<service.ManualBookingOk>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = createManualBookingSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.createManualBooking(parsed.data)
  if (result.status === 'ok') refresh()
  return result
}

export async function updateBookingStatusAction(input: unknown): Promise<ActionResult<service.StatusChangeOk>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = updateBookingStatusSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.updateBookingStatus(parsed.data)
  if (result.status === 'ok') refresh()
  return result
}

export async function undoBookingChangeAction(input: unknown): Promise<ActionResult<null>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = undoSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.undoBookingChange(parsed.data.undoToken)
  refresh()
  return result
}

export async function deleteBookingAction(input: unknown): Promise<ActionResult<service.StatusChangeOk>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = bookingIdSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.deleteBooking(parsed.data.bookingId)
  if (result.status === 'ok') refresh()
  return result
}

export async function updateOwnerNoteAction(input: unknown): Promise<ActionResult<null>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = ownerNoteSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return service.updateOwnerNote(parsed.data.bookingId, parsed.data.ownerNote)
}

export async function reissueConfirmationUrlAction(input: unknown): Promise<ActionResult<{ confirmUrl: string }>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = reissueSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return service.reissueConfirmationUrl(parsed.data)
}

export async function acknowledgeBookingAction(input: unknown): Promise<ActionResult<{ unacknowledged: number }>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = bookingIdSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return service.acknowledgeBooking(parsed.data.bookingId)
}

export async function acknowledgeAllAction(): Promise<ActionResult<{ ids: string[]; unacknowledged: number }>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const result = await service.acknowledgeAll()
  refresh()
  return result
}

export async function unacknowledgeAction(input: unknown): Promise<ActionResult<{ unacknowledged: number }>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = idsSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.unacknowledge(parsed.data.ids)
  refresh()
  return result
}

// ---------------------------------------------------------------- time blocks

export async function createTimeBlockAction(input: unknown): Promise<AdminResult<service.TimeBlockOk>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = createTimeBlockSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.createTimeBlock(parsed.data)
  if (result.status === 'ok') refresh()
  return result
}

export async function deleteTimeBlockAction(input: unknown): Promise<ActionResult<null>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = blockIdSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.deleteTimeBlock(parsed.data.blockId)
  refresh()
  return result
}

export async function restoreTimeBlockAction(input: unknown): Promise<ActionResult<null>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = blockIdSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.restoreTimeBlock(parsed.data.blockId)
  refresh()
  return result
}

// ---------------------------------------------------------------- hours / settings / menus

export async function updateBusinessHoursAction(input: unknown): Promise<ActionResult<null>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = businessHoursSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.updateBusinessHours(parsed.data.days)
  updateTag('hours')
  return result
}

export async function upsertHourOverrideAction(
  input: unknown,
): Promise<ActionResult<{ warnings: { bookingsOnDate: number } }>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = hourOverrideSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.upsertHourOverride(parsed.data)
  updateTag('hours')
  return result
}

export async function deleteHourOverrideAction(input: unknown): Promise<ActionResult<null>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = dateSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.deleteHourOverride(parsed.data.date)
  updateTag('hours')
  return result
}

export async function updateSettingsAction(input: unknown): Promise<ActionResult<null>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.updateSettings(parsed.data)
  updateTag('settings')
  return result
}

export async function upsertMenuAction(input: unknown): Promise<ActionResult<{ menuId: string }>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = upsertMenuSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.upsertMenu(parsed.data)
  if (result.status === 'ok') updateTag('menus')
  return result
}

export async function setMenuActiveAction(input: unknown): Promise<ActionResult<null>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = setMenuActiveSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.setMenuActive(parsed.data.menuId, parsed.data.isActive)
  updateTag('menus')
  return result
}

export async function moveMenuAction(input: unknown): Promise<ActionResult<null>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = moveMenuSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.moveMenu(parsed.data.menuId, parsed.data.direction)
  updateTag('menus')
  return result
}

// ---------------------------------------------------------------- push & devices

export async function subscribePushAction(input: unknown): Promise<ActionResult<{ subscriptionId: string }>> {
  const ctx = await sessionCtx()
  if (!ctx) return UNAUTHORIZED
  const parsed = pushSubscriptionSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return service.subscribePush(parsed.data, ctx)
}

export async function unsubscribePushAction(input: unknown): Promise<ActionResult<null>> {
  const ctx = await sessionCtx()
  if (!ctx) return UNAUTHORIZED
  const byId = subscriptionIdSchema.safeParse(input)
  if (byId.success) return service.unsubscribePush({ subscriptionId: byId.data.subscriptionId }, ctx.userId)
  const parsed = endpointSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return service.unsubscribePush({ endpoint: parsed.data.endpoint }, ctx.userId)
}

export async function touchPushSubscriptionAction(input: unknown): Promise<ActionResult<{ known: boolean }>> {
  const ctx = await sessionCtx()
  if (!ctx) return UNAUTHORIZED
  const parsed = endpointSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return service.touchPushSubscription(parsed.data.endpoint, ctx)
}

export async function sendTestPushAction(): Promise<ActionResult<{ results: service.TestPushResult[] }>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  return service.sendTestPush()
}

export async function logoutOtherDevicesAction(): Promise<
  ActionResult<{ revokedSessions: number; removedSubscriptions: number }>
> {
  const ctx = await sessionCtx()
  if (!ctx) return UNAUTHORIZED
  const result = await service.logoutOtherDevices(ctx)
  refresh()
  return result
}

// ---------------------------------------------------------------- customers (Should)

export async function updateCustomerRestrictionAction(input: unknown): Promise<ActionResult<null>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = restrictionSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.updateCustomerRestriction(parsed.data.customerId, parsed.data.restriction)
  refresh()
  return result
}

export async function exportCustomerAction(input: unknown): Promise<ActionResult<{ filename: string; json: string }>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = customerIdSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return service.exportCustomer(parsed.data.customerId)
}

export async function anonymizeCustomerAction(input: unknown): Promise<ActionResult<{ cancelledBookings: number }>> {
  if (!(await requireAdmin())) return UNAUTHORIZED
  const parsed = anonymizeSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.anonymizeCustomer(parsed.data)
  if (result.status === 'ok') refresh()
  return result
}
