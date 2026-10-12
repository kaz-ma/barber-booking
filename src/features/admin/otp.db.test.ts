import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { devOtpOutbox } from '@/lib/auth-email'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { resetDb, seedAdminSession } from '../../../test/db-helpers'
import { requestAdminOtp, verifyAdminOtp } from './service'

// env.ts parsed process.env when test/db-setup.ts loaded the db module; set the admin here.
;(env as { ADMIN_EMAIL?: string }).ADMIN_EMAIL = 'owner@example.com'

/* Login fallback (06 §3.0, FR-A-01, AT-13): Better Auth emailOTP, offline against Postgres. */

let ipSeq = 0
const ctx = () => ({ ip: `203.0.113.${++ipSeq}`, headers: new Headers({ 'user-agent': 'vitest' }) })

async function lastCode(): Promise<string> {
  const entry = devOtpOutbox.at(-1)
  if (!entry) throw new Error('no OTP captured')
  return entry.otp
}

beforeEach(async () => {
  await resetDb()
  devOtpOutbox.length = 0
  await seedAdminSession('owner@example.com')
})

describe('admin OTP login', () => {
  it('sends a 6-digit code (stored hashed) and a correct code creates a session', async () => {
    expect(await requestAdminOtp(ctx())).toEqual({ status: 'ok', data: null })
    const code = await lastCode()
    expect(code).toMatch(/^\d{6}$/)
    const stored = await db.execute<{ value: string; minutes: number }>(sql`
      SELECT value, round(extract(epoch FROM expires_at - now()) / 60)::int AS minutes FROM auth_verification`)
    expect(stored.rows[0]?.value).not.toContain(code)
    expect(stored.rows[0]?.minutes).toBe(10)

    const sessionsBefore = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM auth_session`)
    const ok = await verifyAdminOtp({ code, next: '/admin/inbox' }, ctx())
    expect(ok).toEqual({ status: 'ok', data: { redirectTo: '/admin/inbox' } })
    const sessionsAfter = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM auth_session`)
    expect(sessionsAfter.rows[0]?.n).toBe((sessionsBefore.rows[0]?.n ?? 0) + 1)
    // Single use
    expect((await verifyAdminOtp({ code }, ctx())).status).toBe('invalid')
  })

  it('rejects a wrong code and an expired code', async () => {
    await requestAdminOtp(ctx())
    const code = await lastCode()
    const wrong = code === '000000' ? '111111' : '000000'
    expect((await verifyAdminOtp({ code: wrong }, ctx())).status).toBe('invalid')
    await db.execute(sql`UPDATE auth_verification SET expires_at = now() - interval '1 second'`)
    expect((await verifyAdminOtp({ code }, ctx())).status).toBe('invalid')
  })

  it('invalidates the code after 5 failed attempts', async () => {
    await requestAdminOtp(ctx())
    const code = await lastCode()
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) expect((await verifyAdminOtp({ code: wrong }, ctx())).status).toBe('invalid')
    expect((await verifyAdminOtp({ code }, ctx())).status).toBe('invalid')
  })

  it('rate-limits code requests per IP (3 per 10 minutes) and never reveals the address', async () => {
    const fixed = { ip: '198.51.100.77', headers: new Headers() }
    for (let i = 0; i < 3; i++) expect((await requestAdminOtp(fixed)).status).toBe('ok')
    expect((await requestAdminOtp(fixed)).status).toBe('rate_limited')
  })

  it('answers the same way when the admin row does not exist', async () => {
    await db.execute(sql`DELETE FROM auth_session`)
    await db.execute(sql`DELETE FROM auth_user`)
    expect(await requestAdminOtp(ctx())).toEqual({ status: 'ok', data: null })
    expect(devOtpOutbox).toHaveLength(0)
  })
})
