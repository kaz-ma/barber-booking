import { describe, expect, it } from 'vitest'
import { applicablePrice, isStudentRateApplied } from './pricing'

describe('pricing (FR-C-04, CR-06)', () => {
  const withStudent = { priceJpy: 5000, priceStudentJpy: 4000 }
  const noStudent = { priceJpy: 5000, priceStudentJpy: null }

  it('applies the student price only when the menu has one', () => {
    expect(applicablePrice(withStudent, 'student')).toBe(4000)
    expect(applicablePrice(noStudent, 'student')).toBe(5000)
    expect(applicablePrice(withStudent, 'worker')).toBe(5000)
  })

  it('reports the student rate as applied only when the price actually changed', () => {
    expect(isStudentRateApplied(withStudent, 'student')).toBe(true)
    expect(isStudentRateApplied(noStudent, 'student')).toBe(false)
    expect(isStudentRateApplied(withStudent, 'worker')).toBe(false)
  })
})
