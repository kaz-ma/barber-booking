/**
 * Client IP from request headers. On Vercel the first x-forwarded-for entry is set by the
 * platform (same as @vercel/functions ipAddress()). Locally it falls back to 127.0.0.1.
 * Only ever stored / logged as an HMAC (rate_limits) or in consents.ip (purged after 1 year).
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  const first = xff?.split(',')[0]?.trim()
  if (first) return first
  return headers.get('x-real-ip')?.trim() || '127.0.0.1'
}
