import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

/*
 * Better Auth endpoints (06_api.md §4): passkey sign-in / registration, get-session (rolling
 * refresh of the 30-day cookie), sign-out, session listing. The emailOTP HTTP endpoints are
 * disabled in src/lib/auth.ts; the OTP fallback goes through Server Actions only.
 */
export const { GET, POST } = toNextJsHandler(auth)
