import { DrizzleQueryError } from 'drizzle-orm'
import { PgPreparedQuery } from 'drizzle-orm/pg-core'

/*
 * Driver-level PII scrub for database errors (CR-01, AGENTS.md rule 6). Drizzle 0.45 throws
 * DrizzleQueryError("Failed query: <sql>\nparams: <every parameter>"), and node-postgres errors
 * carry `detail` ("Key (phone_e164)=(+81…) already exists") or messages that echo input values
 * ('invalid input syntax for type …: "…"'). Anything that escapes to Next.js is printed with
 * console.error (message, cause chain, own properties), so the error is replaced at the source
 * by one that keeps only what the app branches on: SQLSTATE and constraint / table / column.
 *
 * This wraps PgPreparedQuery.queryWithCache, the single place every drizzle query (including
 * BEGIN / COMMIT of interactive transactions) passes through; drizzle-orm is pinned exactly.
 */

/** Sanitised Postgres error: same `code` / `constraint` fields as pg's DatabaseError. */
export class PgError extends Error {
  readonly code: string | undefined
  readonly constraint: string | undefined
  readonly table: string | undefined
  readonly column: string | undefined
  constructor(source: Record<string, unknown>) {
    const code = typeof source.code === 'string' && /^[0-9A-Z_]{1,32}$/.test(source.code) ? source.code : undefined
    const pick = (k: string) => {
      const v = source[k]
      return typeof v === 'string' && /^[A-Za-z0-9_]{1,63}$/.test(v) ? v : undefined
    }
    const constraint = pick('constraint')
    super(`database error${code ? ` ${code}` : ''}${constraint ? ` (${constraint})` : ''}`)
    this.name = 'PgError'
    this.code = code
    this.constraint = constraint
    this.table = pick('table')
    this.column = pick('column')
  }
}

/** Replacement for DrizzleQueryError: no SQL text, no parameters, sanitised cause. */
export class DbQueryError extends Error {
  constructor(cause: unknown) {
    const pg = cause && typeof cause === 'object' ? new PgError(cause as Record<string, unknown>) : undefined
    super(`database query failed${pg?.code ? ` [${pg.code}]` : ''}`, pg ? { cause: pg } : undefined)
    this.name = 'DbQueryError'
  }
}

export function scrubDbError(err: unknown): unknown {
  if (err instanceof DbQueryError) return err
  if (err instanceof DrizzleQueryError) return new DbQueryError(err.cause)
  // A raw driver error (e.g. pool.query outside drizzle) gets the same treatment.
  if (err && typeof err === 'object' && 'severity' in err && 'code' in err) return new DbQueryError(err)
  return err
}

const PATCHED = Symbol.for('bb.scrubDbErrors')

type Patchable = { queryWithCache: (...args: unknown[]) => Promise<unknown>; [PATCHED]?: true }

export function installDbErrorScrubber(): void {
  const proto = PgPreparedQuery.prototype as unknown as Patchable
  if (proto[PATCHED]) return
  const original = proto.queryWithCache
  proto.queryWithCache = async function (this: unknown, ...args: unknown[]) {
    try {
      return await original.apply(this, args)
    } catch (err) {
      throw scrubDbError(err)
    }
  }
  proto[PATCHED] = true
}
