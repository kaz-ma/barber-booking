import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export function sha256(value: string | Buffer): Buffer {
  return createHash('sha256').update(value).digest()
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const DEV_FALLBACK_SECRET = 'dev-only-pii-hash-secret-not-for-production'
let warned = false

function piiSecret(): string {
  if (env.PII_HASH_SECRET) return env.PII_HASH_SECRET
  if (!warned) {
    logger.warn('pii_hash_secret.dev_fallback', { reason: 'PII_HASH_SECRET unset (local only)' })
    warned = true
  }
  return DEV_FALLBACK_SECRET
}

/** HMAC-SHA256(PII_HASH_SECRET, value) as base64url truncated to 22 chars (08_security.md §5). */
export function piiHmac(value: string): string {
  return createHmac('sha256', piiSecret()).update(value).digest('base64url').slice(0, 22)
}
