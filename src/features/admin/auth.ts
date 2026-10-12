import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { type AuthSession, auth } from '@/lib/auth'
import { env } from '@/lib/env'

/*
 * requireAdmin() (API-03, 08_security.md §3.2 / §4): the authorization check for every admin
 * Server Action, Route Handler and page. proxy.ts only does an optimistic cookie check.
 * Better Auth validates the session server-side (auth_session.expires_at). One admin exists
 * (sign-up disabled); when ADMIN_EMAIL is set the session's user must match it.
 * React cache(): at most one session lookup per request.
 */

export type AdminSession = AuthSession

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  if (env.ADMIN_EMAIL && session.user.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) return null
  return session
})

/** For Server Actions / Route Handlers: `null` means answer `unauthorized` / 401. */
export async function requireAdmin(): Promise<AdminSession | null> {
  return getAdminSession()
}

/** For pages: redirect to the login screen, keeping where the owner wanted to go. */
export async function requireAdminPage(next = '/admin'): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) redirect(`/admin/login?next=${encodeURIComponent(next)}`)
  return session
}
