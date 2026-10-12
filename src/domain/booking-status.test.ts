import { describe, expect, it } from 'vitest'
import { canTransition, stepBackTarget } from './booking-status'

describe('booking status machine', () => {
  it('step back goes one progress step at a time (CR-24)', () => {
    expect(stepBackTarget('completed')).toBe('in_progress')
    expect(stepBackTarget('in_progress')).toBe('arrived')
    expect(stepBackTarget('arrived')).toBe('confirmed')
    for (const s of ['confirmed', 'cancelled_by_customer', 'cancelled_by_owner', 'no_show'] as const) {
      expect(stepBackTarget(s)).toBeNull()
    }
  })

  it('reverse steps are not ordinary owner transitions (only via stepBackBookingStatus)', () => {
    expect(canTransition('completed', 'in_progress', 'owner')).toBe(false)
    expect(canTransition('arrived', 'confirmed', 'owner')).toBe(false)
  })
})
