import type { ActionResult } from '@/lib/action-result'

/** 06_api.md §1.1: overlap details for OverlapAlert / block warnings. */
export type OverlapDTO = {
  kind: 'booking' | 'block'
  id: string
  /** JST ISO strings */
  start: string
  end: string
  label: string
}

/**
 * Admin results: the shared ActionResult plus the `conflict: overlap` variant that carries the
 * overlapping bookings (06_api.md §1.1). Kept here so src/lib/action-result.ts stays untouched.
 */
export type AdminResult<T> = ActionResult<T> | { status: 'conflict'; reason: 'overlap'; overlaps: OverlapDTO[] }

export type ManualBookingWarning = 'outside_hours' | 'block_overlap'

export type HoursForDate = { isClosed: boolean; openMin: number | null; closeMin: number | null; isOverride: boolean }

/** B6: choices for "前回の来店から何週間" on the customers screen. */
export const REVISIT_WEEKS = [4, 5, 6, 8] as const
