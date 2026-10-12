import { redirect } from 'next/navigation'
import { describe, expect, it, vi } from 'vitest'
import { guardAction, guardRoute } from './unexpected-error'

/* CR-01: the Server Action / Route Handler boundary never forwards an error message. */

const leaky = () => new Error('Failed query: insert into customers ... params: 山田 太郎,+819012345678')

function capture() {
  const lines: string[] = []
  const spy = vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    lines.push(String(line))
  })
  return { lines, restore: () => spy.mockRestore() }
}

describe('guardAction', () => {
  it('returns the value of a successful action', async () => {
    expect(await guardAction('x', async () => ({ status: 'ok' as const, data: 1 }))).toEqual({ status: 'ok', data: 1 })
  })

  it('turns an exception into { status: error, digest } and logs no message', async () => {
    const c = capture()
    const result = await guardAction('test.failed', async () => {
      throw leaky()
    })
    c.restore()
    expect(result).toEqual({ status: 'error', digest: expect.stringMatching(/^[0-9a-f]{8}$/) })
    expect(c.lines).toHaveLength(1)
    expect(JSON.parse(c.lines[0] ?? '{}')).toEqual({
      level: 'error',
      event: 'test.failed',
      digest: (result as { digest: string }).digest,
      errorName: 'Error',
      errorCode: 'unexpected',
      sqlstate: null,
      constraint: null,
    })
    expect(c.lines.join('')).not.toContain('山田')
  })

  it('rethrows Next.js control flow (redirect)', async () => {
    await expect(guardAction('x', async () => redirect('/ja'))).rejects.toThrow()
  })
})

describe('guardRoute', () => {
  it('answers 500 with the digest only', async () => {
    const c = capture()
    const res = await guardRoute('route.failed', async () => {
      throw leaky()
    })
    c.restore()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: 'internal', digest: expect.any(String) })
    expect(JSON.stringify(body) + c.lines.join('')).not.toContain('+8190')
  })
})
