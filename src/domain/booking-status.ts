/** Booking state machine (05_state_and_flows.md §1.1). */
export const BOOKING_STATUSES = [
  'confirmed',
  'arrived',
  'in_progress',
  'completed',
  'cancelled_by_customer',
  'cancelled_by_owner',
  'cancelled_late',
  'no_show',
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/** Covered by the EXCLUDE constraint and treated as "occupying" a slot. */
export const ACTIVE_STATUSES = ['confirmed', 'arrived', 'in_progress'] as const satisfies readonly BookingStatus[]

export type Actor = 'customer' | 'owner'

const TRANSITIONS: Record<BookingStatus, Partial<Record<BookingStatus, readonly Actor[]>>> = {
  confirmed: {
    cancelled_by_customer: ['customer'],
    cancelled_late: ['owner'],
    cancelled_by_owner: ['owner'],
    arrived: ['owner'],
    no_show: ['owner'],
  },
  arrived: { in_progress: ['owner'] },
  in_progress: { completed: ['owner'] },
  completed: {},
  cancelled_by_customer: {},
  // Undo within 5 seconds (owner only); a 23P01 on undo means the slot was taken meanwhile.
  cancelled_by_owner: { confirmed: ['owner'] },
  cancelled_late: { confirmed: ['owner'] },
  no_show: { confirmed: ['owner'] },
}

export function canTransition(from: BookingStatus, to: BookingStatus, actor: Actor): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false
}

export function isActive(status: BookingStatus): boolean {
  return (ACTIVE_STATUSES as readonly BookingStatus[]).includes(status)
}
