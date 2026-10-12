import 'server-only'
import { allowDevFallbacks, env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { siteUrl } from '@/lib/site'
import { TURNSTILE_ACTION } from '@/lib/turnstile-action'

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type SiteverifyResponse = {
  success: boolean
  hostname?: string
  action?: string
  cdata?: string
  'error-codes'?: string[]
}

/** Hostnames a token may have been issued on: SITE_URL, plus the deployment URLs on previews (CR-19). */
export function allowedTurnstileHostnames(): string[] {
  const hosts = new Set([new URL(siteUrl()).hostname])
  if (env.VERCEL_ENV === 'preview') {
    for (const h of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) if (h) hosts.add(h.replace(/:\d+$/, ''))
  }
  return [...hosts]
}

function siteverifyUrl(): string {
  if (env.TURNSTILE_VERIFY_URL && env.VERCEL_ENV !== 'production') return env.TURNSTILE_VERIFY_URL
  return SITEVERIFY
}

/**
 * Cloudflare Turnstile siteverify (08_security.md §7, FR-S-05). Fail closed on timeout / 5xx.
 *
 * SR-03: no `idempotency_key` is sent, so Cloudflare accepts each token exactly once (a replay
 * gets `timeout-or-duplicate`); a network-level resubmission is handled by the booking
 * idempotency key instead. The widget passes the submission nonce as `cData`, and the token is
 * accepted only when siteverify echoes that nonce, the expected action and an allowed hostname.
 *
 * SR-05: without TURNSTILE_SECRET_KEY verification is skipped in development / test only; in
 * production it fails closed (env.ts also refuses to start without the key).
 */
export async function verifyTurnstile(input: { token: string; ip: string; nonce: string }): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (!allowDevFallbacks) {
      logger.error('turnstile.unconfigured', { reason: 'TURNSTILE_SECRET_KEY unset in production' })
      return false
    }
    logger.info('turnstile.skipped', { reason: 'TURNSTILE_SECRET_KEY unset (development / test)' })
    return true
  }
  try {
    const body = new URLSearchParams({ secret, response: input.token, remoteip: input.ip })
    const res = await fetch(siteverifyUrl(), {
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
    const checks = {
      success: data.success === true,
      action: data.action === TURNSTILE_ACTION,
      hostname: typeof data.hostname === 'string' && allowedTurnstileHostnames().includes(data.hostname),
      cdata: typeof data.cdata === 'string' && data.cdata === input.nonce,
    }
    const ok = Object.values(checks).every(Boolean)
    if (!ok) {
      logger.info('turnstile.rejected', {
        errorCodes: data['error-codes'] ?? [],
        failed: Object.entries(checks)
          .filter(([, v]) => !v)
          .map(([k]) => k)
          .join(','),
      })
    }
    return ok
  } catch (err) {
    logger.warn('turnstile.unavailable', { errorName: err instanceof Error ? err.name : 'unknown' })
    return false
  }
}
