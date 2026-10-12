import type { ActionResult } from '@/lib/action-result'

/** i18n keys under booking.errors (06_api.md §5). */
export const BOOKING_ERROR_KEYS = [
  'menuRequired',
  'nameRequired',
  'nameTooLong',
  'nameInvalid',
  'kanaRequired',
  'kanaHiragana',
  'kanaTooLong',
  'occupationRequired',
  'phoneRequired',
  'phoneInvalid',
  'noteTooLong',
  'consentRequired',
  'startsAtInvalid',
  'invalid',
  'botCheckFailed',
  'notBookable',
  'slotTaken',
  'duplicate',
  'rateLimited',
  'restricted',
  'error',
] as const
export type BookingErrorKey = (typeof BOOKING_ERROR_KEYS)[number]

export function asErrorKey(key: string | undefined): BookingErrorKey {
  return (BOOKING_ERROR_KEYS as readonly string[]).includes(key ?? '') ? (key as BookingErrorKey) : 'invalid'
}

/** Form-level message for a non-ok action result (field errors are shown per field). */
export function resultMessageKey(result: ActionResult<unknown> | null): BookingErrorKey | null {
  if (!result) return null
  switch (result.status) {
    case 'ok':
      return null
    case 'invalid':
      return result.reason === 'not_bookable' ? 'notBookable' : 'invalid'
    case 'conflict':
    case 'duplicate':
      // One customer-facing message for both (SR-12): "duplicate" would reveal that this phone
      // number already holds the slot. The service answers `conflict: slot_taken` for both.
      return 'slotTaken'
    case 'rate_limited':
      return 'rateLimited'
    case 'bot_check_failed':
      return 'botCheckFailed'
    case 'restricted':
      return 'restricted'
    default:
      return 'error'
  }
}
