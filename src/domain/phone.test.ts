import { describe, expect, it } from 'vitest'
import { isValidE164, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it.each([
    ['09012345678', '+819012345678'],
    ['090-1234-5678', '+819012345678'],
    ['090 1234 5678', '+819012345678'],
    ['０９０－１２３４－５６７８', '+819012345678'], // full-width digits and hyphen (NFKC)
    ['０９０ー１２３４ー５６７８', '+819012345678'], // katakana prolonged sound mark as dash
    ['090‐1234‐5678', '+819012345678'], // U+2010 hyphen
    ['090–1234—5678', '+819012345678'], // en / em dash
    ['090−1234−5678', '+819012345678'], // U+2212 minus
    ['03-1234-5678', '+81312345678'], // 10-digit landline
    ['(03) 1234-5678', '+81312345678'],
    ['+81 90 1234 5678', '+819012345678'],
    ['+81 090 1234 5678', '+819012345678'], // trunk 0 kept after country code
    ['＋８１９０１２３４５６７８', '+819012345678'],
    ['+44 7700 900123', '+447700900123'],
    ['  09012345678  ', '+819012345678'],
  ])('%s -> %s', (input, expected) => {
    const out = normalizePhone(input)
    expect(out).toBe(expected)
    expect(isValidE164(out)).toBe(true)
  })

  it.each([
    '',
    '12345',
    '0901234567890', // too long for JP domestic
    '+8101234567', // JP number must not start with 0 after +81
    '+81123', // too short
    'abc',
    '090-1234-567a',
    '+0123456789',
  ])('rejects %j', (input) => {
    expect(isValidE164(normalizePhone(input))).toBe(false)
  })
})
