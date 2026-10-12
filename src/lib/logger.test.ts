import { describe, expect, it } from 'vitest'
import { redact } from './logger'

describe('logger redaction (SR-23)', () => {
  it('masks known PII keys case-insensitively and in nested objects / arrays', () => {
    const out = redact({
      bookingId: 'b1',
      Phone: '+81',
      input: { name: 'x', nested: [{ EMAIL: 'a@b', ok: 1 }] },
      authorization: 'Bearer y',
      message: 'Failed query ... params ...',
    })
    expect(out).toEqual({
      bookingId: 'b1',
      Phone: '[redacted]',
      input: { name: '[redacted]', nested: [{ EMAIL: '[redacted]', ok: 1 }] },
      authorization: '[redacted]',
      message: '[redacted]',
    })
  })

  it('never serialises Error objects', () => {
    expect(redact({ err: new TypeError('params: 090-1234-5678') })).toEqual({ err: '[TypeError]' })
  })
})
