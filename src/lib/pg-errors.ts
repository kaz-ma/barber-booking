/**
 * SQLSTATE mapping (04_data_model.md §3.1). Distinguish by constraint name, not message.
 * Drizzle wraps driver errors (DrizzleQueryError) so walk the `cause` chain.
 */
export type PgErrorInfo = { code: string; constraint?: string }

export function pgErrorOf(err: unknown): PgErrorInfo | null {
  let cur: unknown = err
  for (let depth = 0; cur && depth < 5; depth++) {
    if (typeof cur === 'object' && cur !== null && 'code' in cur) {
      const code = (cur as { code?: unknown }).code
      if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
        const constraint = (cur as { constraint?: unknown }).constraint
        return { code, constraint: typeof constraint === 'string' ? constraint : undefined }
      }
    }
    cur = (cur as { cause?: unknown }).cause
  }
  return null
}

/** 23P01 exclusion_violation */
export function isExclusionViolation(err: unknown, constraint?: string): boolean {
  const info = pgErrorOf(err)
  return info?.code === '23P01' && (!constraint || info.constraint === constraint)
}

/** 23505 unique_violation */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const info = pgErrorOf(err)
  return info?.code === '23505' && (!constraint || info.constraint === constraint)
}

export const CONSTRAINTS = {
  noOverlap: 'bookings_no_overlap',
  idempotencyActive: 'bookings_idempotency_active_uidx',
  publicCode: 'bookings_public_code_unique',
  cancelTokenHash: 'bookings_cancel_token_hash_unique',
} as const
