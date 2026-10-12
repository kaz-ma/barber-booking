import 'server-only'
import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { authCookiePrefix, isSecureOrigin, SESSION_MAX_AGE_SEC, SESSION_UPDATE_AGE_SEC } from '@/lib/auth-cookie'
import { sendAdminOtpEmail } from '@/lib/auth-email'
import { db } from '@/lib/db'
import { authAccount, authPasskey, authRateLimit, authSession, authUser, authVerification } from '@/lib/db/schema'
import { env } from '@/lib/env'
import { passkeyUserVerificationHooks } from '@/lib/passkey-uv'
import { secretOrEphemeral } from '@/lib/secrets'
import { siteUrl } from '@/lib/site'

/*
 * Better Auth 1.7 for the single admin (ADR-0006, 08_security.md §4).
 *   - Postgres through the shared node-postgres pool + Drizzle adapter, tables auth_* .
 *   - passkey() is the primary login; rpID = SITE_URL host (localhost locally).
 *   - emailOTP() is the in-app fallback: 6 digits, 10 minutes, 5 attempts, stored hashed,
 *     sign-up disabled. Its HTTP endpoints are disabled: only the requestAdminOtp /
 *     verifyAdminOtp Server Actions (with their own rate limits) may call it.
 *   - No password, no sign-up. The admin row is created by scripts/seed-admin.ts.
 *   - Persistent 30-day rolling session cookie (Max-Age, never a session cookie), `__Host-`.
 *   - nextCookies() must be the last plugin: it lets Server Actions set the session cookie.
 */

/** Required in production (SR-05); random per process in development / test / build. */
export const authSecret = (): string => secretOrEphemeral('BETTER_AUTH_SECRET', env.BETTER_AUTH_SECRET)

export const OTP_LENGTH = 6
export const OTP_EXPIRES_SEC = 10 * 60
export const OTP_ALLOWED_ATTEMPTS = 5

const secure = isSecureOrigin()
const origin = siteUrl()

export const auth = betterAuth({
  appName: '予約管理',
  baseURL: origin,
  basePath: '/api/auth',
  secret: authSecret(),
  trustedOrigins: [origin],
  telemetry: { enabled: false },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
      passkey: authPasskey,
      rateLimit: authRateLimit,
    },
  }),
  emailAndPassword: { enabled: false },
  session: {
    expiresIn: SESSION_MAX_AGE_SEC,
    updateAge: SESSION_UPDATE_AGE_SEC,
  },
  advanced: {
    // The prefix is chosen explicitly (`__Host-bb` over HTTPS) instead of Better Auth's
    // automatic `__Secure-`, so it must not add its own prefix on top.
    useSecureCookies: false,
    cookiePrefix: authCookiePrefix(),
    defaultCookieAttributes: { secure, httpOnly: true, sameSite: 'lax', path: '/' },
    ipAddress: { ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'] },
  },
  rateLimit: {
    enabled: env.NODE_ENV === 'production',
    storage: 'database',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/passkey': { window: 600, max: 10 },
      '/passkey/verify-authentication': { window: 600, max: 10 },
    },
  },
  disabledPaths: [
    '/email-otp/send-verification-otp',
    '/email-otp/check-verification-otp',
    '/email-otp/verify-email',
    '/sign-in/email-otp',
    '/forget-password/email-otp',
    '/email-otp/request-password-reset',
    '/email-otp/reset-password',
    '/email-otp/change-email',
    '/email-otp/request-email-change',
    '/update-user',
    '/delete-user',
    '/change-email',
  ],
  plugins: [
    passkey({
      rpID: new URL(origin).hostname,
      rpName: '予約管理',
      origin,
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      // Enforce the UV flag server-side on both ceremonies (SR-07).
      registration: passkeyUserVerificationHooks.registration,
      authentication: passkeyUserVerificationHooks.authentication,
    }),
    emailOTP({
      otpLength: OTP_LENGTH,
      expiresIn: OTP_EXPIRES_SEC,
      allowedAttempts: OTP_ALLOWED_ATTEMPTS,
      storeOTP: 'hashed',
      disableSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== 'sign-in') return
        await sendAdminOtpEmail(email, otp)
      },
    }),
    nextCookies(),
  ],
})

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>
