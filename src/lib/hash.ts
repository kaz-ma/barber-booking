import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import { env } from '@/lib/env'
import { secretOrEphemeral } from '@/lib/secrets'

export function sha256(value: string | Buffer): Buffer {
  return createHash('sha256').update(value).digest()
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Required in production (SR-05); random per process in development / test. */
const piiSecret = (): string => secretOrEphemeral('PII_HASH_SECRET', env.PII_HASH_SECRET)

/** HMAC-SHA256(PII_HASH_SECRET, value) as base64url truncated to 22 chars (08_security.md §5). */
export function piiHmac(value: string): string {
  return createHmac('sha256', piiSecret()).update(value).digest('base64url').slice(0, 22)
}
