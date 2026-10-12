import 'server-only'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { siteUrl } from '@/lib/site'

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
export const TURNSTILE_ACTION = 'create_booking'

type SiteverifyResponse = {
  success: boolean
  hostname?: string
  action?: string
  'error-codes'?: string[]
}

/**
 * Cloudflare Turnstile siteverify (08_security.md §7, FR-S-05). Fail closed on timeout / 5xx.
 * When TURNSTILE_SECRET_KEY is unset (local dev / tests only; env.ts requires it when
 * deployed) verification is skipped with a log line.
 */
export async function verifyTurnstile(input: {
  token: string
  ip: string
  idempotencyKey: string
}): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY
  if (!secret) {
    logger.info('turnstile.skipped', { reason: 'TURNSTILE_SECRET_KEY unset' })
    return true
  }
  try {
    const body = new URLSearchParams({
      secret,
      response: input.token,
      remoteip: input.ip,
      idempotency_key: input.idempotencyKey,
    })
    const res = await fetch(SITEVERIFY, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    })
    if (!res.ok) {
      logger.warn('turnstile.http_error', { status: res.status })
      return false
    }
    const data = (await res.json()) as SiteverifyResponse
    const expectedHost = new URL(siteUrl()).hostname
    const ok = data.success && data.hostname === expectedHost && data.action === TURNSTILE_ACTION
    if (!ok) logger.info('turnstile.rejected', { errorCodes: data['error-codes'] ?? [] })
    return ok
  } catch (err) {
    logger.warn('turnstile.unavailable', { error: err instanceof Error ? err.name : 'unknown' })
    return false
  }
}
