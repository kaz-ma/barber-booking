import { describe, expect, it } from 'vitest'
import { resultMessageKey } from './messages'

describe('resultMessageKey', () => {
  it('shows the same message for duplicate and slot_taken (SR-12)', () => {
    expect(resultMessageKey({ status: 'duplicate' })).toBe('slotTaken')
    expect(resultMessageKey({ status: 'conflict', reason: 'slot_taken' })).toBe('slotTaken')
  })
  it('maps the other failures', () => {
    expect(resultMessageKey({ status: 'invalid', fieldErrors: {}, reason: 'not_bookable' })).toBe('notBookable')
    expect(resultMessageKey({ status: 'rate_limited', retryAfterSec: 1 })).toBe('rateLimited')
    expect(resultMessageKey({ status: 'error', digest: 'x' })).toBe('error')
    expect(resultMessageKey(null)).toBeNull()
  })
})
