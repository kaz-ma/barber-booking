import 'server-only'
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { sha256 } from '@/lib/hash'

/** 32 random bytes as base64url = 43 chars (256 bit, FR-S-06). */
export const CANCEL_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export function isCancelTokenFormat(token: string): boolean {
  return CANCEL_TOKEN_RE.test(token)
}

/** Raw token goes to the customer only (URL path); the DB stores SHA-256(raw). */
export function issueCancelToken(): { raw: string; hash: Buffer } {
  const raw = randomBytes(32).toString('base64url')
  return { raw, hash: sha256(raw) }
}

export function hashCancelToken(raw: string): Buffer {
  return sha256(raw)
}

export function hashesEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Booking number shown to customers: Crockford base32, 8 chars (~40 bit). Not a secret. */
export function generatePublicCode(): string {
  let out = ''
  for (let i = 0; i < 8; i++) out += CROCKFORD[randomInt(32)]
  return out
}
