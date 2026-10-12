import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { envMode, parseServerEnv, serverSchema } from './env-schema'

/* SR-05: secrets are required whenever the app runs in production mode, on any platform. */

const SECRETS = [
  'SITE_URL',
  'BETTER_AUTH_SECRET',
  'PII_HASH_SECRET',
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'CRON_SECRET',
  'ADMIN_EMAIL',
  'RESEND_API_KEY',
  'RESEND_FROM',
]

describe('envMode', () => {
  it('NODE_ENV=production is strict regardless of VERCEL_ENV (Cloudflare, next start, Docker)', () => {
    expect(envMode({ NODE_ENV: 'production' })).toEqual({
      strict: true,
      allowDevFallbacks: false,
      skipValidation: false,
    })
    expect(envMode({ NODE_ENV: 'production', VERCEL_ENV: 'production' }).strict).toBe(true)
  })

  it('SKIP_ENV_VALIDATION is ignored in production and on deployed Vercel environments', () => {
    expect(envMode({ NODE_ENV: 'production', SKIP_ENV_VALIDATION: '1' }).skipValidation).toBe(false)
    expect(envMode({ NODE_ENV: 'development', VERCEL_ENV: 'preview', SKIP_ENV_VALIDATION: '1' }).skipValidation).toBe(
      false,
    )
    expect(envMode({ SKIP_ENV_VALIDATION: '1' }).skipValidation).toBe(true)
  })

  it('`next build` (CI, no secrets) is lenient; development and test allow dev fallbacks', () => {
    expect(envMode({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })).toEqual({
      strict: false,
      allowDevFallbacks: true,
      skipValidation: false,
    })
    expect(envMode({ NODE_ENV: 'development' })).toMatchObject({ strict: false, allowDevFallbacks: true })
    expect(envMode({ NODE_ENV: 'test' })).toMatchObject({ strict: false, allowDevFallbacks: true })
    expect(envMode({})).toMatchObject({ strict: false, allowDevFallbacks: true })
  })

  it('a Vercel preview is strict even with a non-production NODE_ENV', () => {
    expect(envMode({ NODE_ENV: 'development', VERCEL_ENV: 'preview' })).toMatchObject({
      strict: true,
      allowDevFallbacks: false,
    })
  })
})

describe('serverSchema', () => {
  const minimal = { DATABASE_URL: 'postgresql://u@localhost:5432/db' }

  it('strict: every secret is required', () => {
    const result = z.object(serverSchema(true)).safeParse(minimal)
    expect(result.success).toBe(false)
    const missing = new Set(result.error?.issues.map((i) => String(i.path[0])))
    for (const key of SECRETS) expect(missing.has(key)).toBe(true)
  })

  it('strict: short secrets are rejected', () => {
    const full = Object.fromEntries(SECRETS.map((k) => [k, 'x'.repeat(40)]))
    const ok = {
      ...minimal,
      ...full,
      SITE_URL: 'https://shop.example',
      VAPID_SUBJECT: 'mailto:o@example.com',
      ADMIN_EMAIL: 'owner@example.com',
    }
    expect(z.object(serverSchema(true)).safeParse(ok).success).toBe(true)
    expect(z.object(serverSchema(true)).safeParse({ ...ok, PII_HASH_SECRET: 'short' }).success).toBe(false)
  })

  it('lenient: only DATABASE_URL is needed', () => {
    expect(z.object(serverSchema(false)).safeParse(minimal).success).toBe(true)
  })
})

describe('parseServerEnv (next.config.ts)', () => {
  it('throws in production without secrets, listing the keys but not values', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:pw@h/db' })).toThrow(
      /BETTER_AUTH_SECRET/,
    )
  })
  it('passes during next build and treats empty strings as unset', () => {
    const env = parseServerEnv({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
      DATABASE_URL: 'postgresql://u@h/db',
      SITE_URL: '',
    })
    expect(env.SITE_URL).toBeUndefined()
  })
})
