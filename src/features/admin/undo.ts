import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

/*
 * Undo tokens for owner status changes (05_state_and_flows.md §1.1, 08_security.md §5):
 * { bookingId, prev, next, exp } HMAC-signed with a key derived from BETTER_AUTH_SECRET.
 * Not stored. `h` carries the previous cancel-token hash so undo can restore the customer's
 * confirmation link (the hash is not a secret capability; the raw token never leaves the DB
 * owner's device).
 */

export const UNDO_WINDOW_MS = 10_000

export type UndoPayload = {
  b: string
  prev: string
  next: string
  exp: number
  /** base64url cancel_token_hash before the change */
  h?: string
  /** set when the change also soft-deleted the row (deleteBooking) */
  d?: 1
}

function key(): Buffer {
  const secret = env.BETTER_AUTH_SECRET ?? 'dev-only-better-auth-secret-not-for-production-0123456789'
  return createHmac('sha256', secret).update('bb-undo-token-v1').digest()
}

function sign(body: string): string {
  return createHmac('sha256', key()).update(body).digest('base64url')
}

export function signUndo(payload: UndoPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyUndo(token: string, now: Date): UndoPayload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UndoPayload
    if (typeof p.exp !== 'number' || now.getTime() > p.exp) return null
    return p
  } catch {
    return null
  }
}
