import 'server-only'
import { randomBytes } from 'node:crypto'
import { allowDevFallbacks } from '@/lib/env'
import { logger } from '@/lib/logger'

/*
 * Secrets without hard-coded fallbacks (SR-05). In production env.ts already refuses to start
 * without them; this throws as a second line of defence. In development / test / `next build`
 * a missing secret is replaced by a random per-process value with a loud warning — never by a
 * value that is checked into the repository (a known HMAC key would let anyone reverse
 * phone_hash / phone_tail by brute force, and a known auth secret would forge sessions).
 */

const store = globalThis as unknown as { __bbEphemeralSecrets?: Map<string, string> }

export function secretOrEphemeral(variable: string, value: string | undefined): string {
  if (value) return value
  if (!allowDevFallbacks) throw new Error(`${variable} is required in production`)
  store.__bbEphemeralSecrets ??= new Map()
  const secrets = store.__bbEphemeralSecrets
  let ephemeral = secrets.get(variable)
  if (!ephemeral) {
    ephemeral = randomBytes(32).toString('base64url')
    secrets.set(variable, ephemeral)
    logger.warn('secret.ephemeral', {
      variable,
      reason: 'unset; using a random per-process value (development / test / build only, never at production runtime)',
    })
  }
  return ephemeral
}
