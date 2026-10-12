import 'server-only'
import { env } from '@/lib/env'

/**
 * Absolute origin (FR-S-10, U-08). Resolution order (DES-00 §4):
 * SITE_URL -> https://VERCEL_PROJECT_PRODUCTION_URL (production) -> https://VERCEL_URL (preview)
 * -> http://localhost:3000. Deployed environments require SITE_URL (validated in env.ts).
 * The DB never stores absolute URLs; only token hashes and relative paths.
 */
export function siteUrl(): string {
  if (env.SITE_URL) return env.SITE_URL
  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export function absoluteUrl(path: `/${string}`): string {
  return `${siteUrl()}${path}`
}
