import type { z } from 'zod'

/** Discriminated result for Server Actions (06_api.md §1.1). Expected errors are values. */
export type ActionResult<T = void> =
  | { status: 'ok'; data: T }
  | { status: 'invalid'; fieldErrors: Record<string, string[]>; reason?: 'not_bookable' }
  | { status: 'conflict'; reason: 'slot_taken' | 'overlap' | 'undo_blocked' }
  | { status: 'duplicate' }
  | { status: 'rate_limited'; retryAfterSec: number }
  | { status: 'bot_check_failed' }
  | { status: 'restricted' }
  | { status: 'past_deadline' }
  | { status: 'not_found' }
  | { status: 'unauthorized' }
  | { status: 'error'; digest: string }

/** Field errors carry message *keys* (booking.errors.*), resolved by next-intl on the client. */
export function invalid(error: z.ZodError): Extract<ActionResult<never>, { status: 'invalid' }> {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return { status: 'invalid', fieldErrors }
}
