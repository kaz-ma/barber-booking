import { pgErrorOf } from '@/lib/pg-errors'

/*
 * Transient database failures (connection could not be opened or was cut before any work was
 * committed). Neon suspends an idle Free compute and can drop or refuse connections while it
 * wakes up; a single quick retry hides that from the customer. Only failures that cannot have
 * committed anything qualify, so retrying is always safe (the booking insert is additionally
 * idempotent through the submission nonce, G-04).
 */

/** 57P01 admin_shutdown, 57P02 crash_shutdown, 57P03 cannot_connect_now, 08xxx connection exceptions. */
const TRANSIENT_SQLSTATE = /^(57P0[123]|08\d{3})$/
const TRANSIENT_NODE_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN'])
const TRANSIENT_MESSAGE =
  /Connection terminated|timeout exceeded when trying to connect|Connection terminated due to connection timeout|connection is insecure|Client has encountered a connection error/i

export function isTransientDbError(err: unknown): boolean {
  const pg = pgErrorOf(err)
  if (pg && TRANSIENT_SQLSTATE.test(pg.code)) return true
  let cur: unknown = err
  for (let depth = 0; cur && depth < 5; depth++) {
    if (typeof cur === 'object' && cur !== null) {
      const code = (cur as { code?: unknown }).code
      if (typeof code === 'string' && TRANSIENT_NODE_CODES.has(code)) return true
      const message = (cur as { message?: unknown }).message
      if (typeof message === 'string' && TRANSIENT_MESSAGE.test(message)) return true
    }
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

/** Run `fn`, retrying once (after `delayMs`) when it fails with a transient database error. */
export async function withDbRetry<T>(fn: () => Promise<T>, delayMs = 250): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (!isTransientDbError(err)) throw err
    await new Promise((r) => setTimeout(r, delayMs))
    return fn()
  }
}
