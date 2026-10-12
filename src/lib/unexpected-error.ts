import 'server-only'
import { randomUUID } from 'node:crypto'
import { unstable_rethrow } from 'next/navigation'
import { logger } from '@/lib/logger'
import { errorFields } from '@/lib/pg-errors'

/*
 * Unexpected errors (AGENTS.md rule 2 + 6, CR-01). Expected failures are ActionResult values;
 * anything else is logged once with a short digest and PII-free fields (error class, SQLSTATE,
 * constraint) and the caller only sees `{ status: 'error', digest }`. Next.js control-flow
 * errors (redirect / notFound / dynamic bailouts) are rethrown untouched.
 */

export type UnexpectedResult = { status: 'error'; digest: string }

export function newDigest(): string {
  return randomUUID().slice(0, 8)
}

/** Log an unexpected error without its message and return the generic result. */
export function unexpectedError(err: unknown, event: string): UnexpectedResult {
  const digest = newDigest()
  logger.error(event, { digest, ...errorFields(err) })
  return { status: 'error', digest }
}

/**
 * Server Action boundary: run `fn`, turning any escaped exception into a logged digest so the
 * raw error (whose message may embed SQL parameters) never reaches Next.js' own error log.
 */
export async function guardAction<T>(event: string, fn: () => Promise<T>): Promise<T | UnexpectedResult> {
  try {
    return await fn()
  } catch (err) {
    unstable_rethrow(err)
    return unexpectedError(err, event)
  }
}

/** Route Handler boundary: same logging, answers 500 with the digest only. */
export async function guardRoute(event: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (err) {
    unstable_rethrow(err)
    const { digest } = unexpectedError(err, event)
    return Response.json({ error: 'internal', digest }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
