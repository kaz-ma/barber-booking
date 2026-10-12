import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/* Turnstile siteverify (SR-03, SR-05, CR-19) with a mocked fetch. */

const mocked = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  allowDevFallbacks: true,
}))
vi.mock('@/lib/env', () => mocked)

const { verifyTurnstile, allowedTurnstileHostnames } = await import('./turnstile')

const NONCE = '6f1c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f'
const input = { token: 'tok', ip: '203.0.113.5', nonce: NONCE }
const good = { success: true, hostname: 'shop.example', action: 'create_booking', cdata: NONCE }

let fetchMock: ReturnType<typeof vi.fn>
function respond(body: unknown, status = 200) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }))
}

beforeEach(() => {
  mocked.env = { TURNSTILE_SECRET_KEY: 'secret', SITE_URL: 'https://shop.example' }
  mocked.allowDevFallbacks = false
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('verifyTurnstile', () => {
  it('accepts a token whose action, hostname and cdata (= nonce) match; sends no idempotency_key', async () => {
    respond(good)
    expect(await verifyTurnstile(input)).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    const body = new URLSearchParams(String(init.body))
    expect(Object.fromEntries(body)).toEqual({ secret: 'secret', response: 'tok', remoteip: '203.0.113.5' })
    expect(body.has('idempotency_key')).toBe(false)
  })

  it.each([
    ['cdata from another submission (replayed token)', { ...good, cdata: 'other-nonce' }],
    ['missing cdata', { ...good, cdata: undefined }],
    ['foreign hostname', { ...good, hostname: 'evil.example' }],
    ['wrong action', { ...good, action: 'login' }],
    ['already used (timeout-or-duplicate)', { success: false, 'error-codes': ['timeout-or-duplicate'] }],
  ])('rejects %s', async (_label, body) => {
    respond(body)
    expect(await verifyTurnstile(input)).toBe(false)
  })

  it('fails closed on HTTP errors and network failures / timeouts', async () => {
    respond({}, 500)
    expect(await verifyTurnstile(input)).toBe(false)
    fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    expect(await verifyTurnstile(input)).toBe(false)
  })

  it('without a secret: skipped only when dev fallbacks are allowed, rejected in production (SR-05)', async () => {
    mocked.env = { SITE_URL: 'https://shop.example' }
    mocked.allowDevFallbacks = true
    expect(await verifyTurnstile(input)).toBe(true)
    mocked.allowDevFallbacks = false
    expect(await verifyTurnstile(input)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts the deployment hostnames on Vercel previews only (CR-19)', async () => {
    mocked.env = { ...mocked.env, VERCEL_URL: 'bb-git-x.vercel.app', VERCEL_BRANCH_URL: 'bb-branch.vercel.app' }
    expect(allowedTurnstileHostnames()).toEqual(['shop.example'])
    mocked.env.VERCEL_ENV = 'preview'
    expect(allowedTurnstileHostnames()).toEqual(['shop.example', 'bb-git-x.vercel.app', 'bb-branch.vercel.app'])
    respond({ ...good, hostname: 'bb-git-x.vercel.app' })
    expect(await verifyTurnstile(input)).toBe(true)
  })

  it('honours the test siteverify endpoint except on a Vercel production deployment', async () => {
    mocked.env = { ...mocked.env, TURNSTILE_VERIFY_URL: 'http://127.0.0.1:9/siteverify' }
    respond(good)
    await verifyTurnstile(input)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:9/siteverify')
    mocked.env.VERCEL_ENV = 'production'
    await verifyTurnstile(input)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
  })
})
