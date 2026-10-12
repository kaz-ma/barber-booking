import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

/** `Authorization: Bearer <CRON_SECRET>` compared in constant time (T-18). Unset secret = deny. */
export function isAuthorizedCron(authorization: string | null): boolean {
  const secret = env.CRON_SECRET
  if (!secret || !authorization) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(authorization)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
