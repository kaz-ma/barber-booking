import 'server-only'
import { siteUrl } from '@/lib/site'

/*
 * Session cookie naming (08_security.md §4, ADR-0006). Over HTTPS every Better Auth cookie is
 * `__Host-bb.*`: Secure, Path=/, no Domain. Plain-HTTP local development cannot use the
 * `__Host-` prefix (it requires Secure), so the prefix there is just `bb`.
 * proxy.ts uses SESSION_COOKIE_NAME for its optimistic redirect only — never for authorization.
 */
export const isSecureOrigin = (): boolean => siteUrl().startsWith('https://')

export const authCookiePrefix = (): string => (isSecureOrigin() ? '__Host-bb' : 'bb')

export const sessionCookieName = (): string => `${authCookiePrefix()}.session_token`

/** 30-day rolling session: persistent cookie with Max-Age (WebKit 272325), refreshed daily. */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30
export const SESSION_UPDATE_AGE_SEC = 60 * 60 * 24
