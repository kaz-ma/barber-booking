import { describe, expect, it, vi } from 'vitest'
import { isTransientDbError, withDbRetry } from './transient'

describe('isTransientDbError', () => {
  it('recognises connection failures, also when wrapped by Drizzle', () => {
    expect(isTransientDbError(Object.assign(new Error('x'), { code: 'ECONNRESET' }))).toBe(true)
    expect(isTransientDbError(new Error('timeout exceeded when trying to connect'))).toBe(true)
    expect(isTransientDbError({ cause: Object.assign(new Error('terminating'), { code: '57P01' }) })).toBe(true)
    expect(isTransientDbError({ cause: { code: '57P03' } })).toBe(true)
  })
  it('does not retry real query errors', () => {
    expect(isTransientDbError({ cause: { code: '23505' } })).toBe(false)
    expect(isTransientDbError({ cause: { code: '23P01' } })).toBe(false)
    expect(isTransientDbError(new Error('boom'))).toBe(false)
  })
})

describe('withDbRetry', () => {
  it('retries once after a transient failure', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'ECONNRESET' }))
      .mockResolvedValue(1)
    await expect(withDbRetry(fn, 0)).resolves.toBe(1)
    expect(fn).toHaveBeenCalledTimes(2)
  })
  it('does not retry other errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(withDbRetry(fn, 0)).rejects.toThrow('boom')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
