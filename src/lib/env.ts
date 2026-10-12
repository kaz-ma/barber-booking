import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

/**
 * Typed environment (DES-00 §4). This is the ONLY module allowed to read `process.env`
 * (Biome `noProcessEnv` enforces it; config files and scripts are the documented exceptions).
 *
 * Fail closed (SR-05): secrets are required whenever the app runs in production mode —
 * `NODE_ENV=production` on any platform (Vercel, Cloudflare, `next start`, Docker), plus Vercel
 * preview deployments. Only `next build` itself (NEXT_PHASE=phase-production-build; next.config.ts
 * sets it before loading this module) and development / test may run without them, so CI can
 * build without secrets and `npm run dev` / `npm test` work with only `DATABASE_URL`.
 * `SKIP_ENV_VALIDATION=1` is honoured outside production only.
 * Public values (VAPID public key, Turnstile site key) are passed from the server as props,
 * so there are no `NEXT_PUBLIC_` variables here (CON-05).
 */

type RawEnv = Record<string, string | undefined>

export type EnvMode = {
  /** Secrets are required (production runtime or a deployed Vercel environment). */
  strict: boolean
  /** Dev-only conveniences (ephemeral secrets, Turnstile skip) are allowed. */
  allowDevFallbacks: boolean
  skipValidation: boolean
}

export function envMode(raw: RawEnv): EnvMode {
  const building = raw.NEXT_PHASE === 'phase-production-build'
  const productionRuntime = raw.NODE_ENV === 'production' && !building
  const deployed = raw.VERCEL_ENV === 'production' || raw.VERCEL_ENV === 'preview'
  const strict = productionRuntime || (deployed && !building)
  return {
    strict,
    allowDevFallbacks: building || (!strict && raw.NODE_ENV !== 'production'),
    skipValidation: raw.SKIP_ENV_VALIDATION === '1' && !productionRuntime && !deployed,
  }
}

const secret = (min = 32) => z.string().min(min)

/** Server variable schemas; `strict` makes every secret mandatory. Exported for the unit test. */
export function serverSchema(strict: boolean) {
  const required = <T extends z.ZodType>(schema: T) => (strict ? schema : schema.optional())
  return {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
    VERCEL_URL: z.string().optional(),
    VERCEL_BRANCH_URL: z.string().optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),

    /** Absolute origin without trailing slash, e.g. https://xxxx.vercel.app (FR-S-10). */
    SITE_URL: required(z.url().refine((v) => !v.endsWith('/'), 'SITE_URL must not end with a slash')),
    /** Pooled connection string (Neon `-pooler`) or the local cluster from scripts/db-local.sh. */
    DATABASE_URL: z.url(),
    /** Direct (unpooled) connection for migrations and pg_dump. Falls back to DATABASE_URL. */
    DATABASE_URL_UNPOOLED: z.url().optional(),

    BETTER_AUTH_SECRET: required(secret()),
    ADMIN_EMAIL: z.email().optional(),
    RESEND_API_KEY: z.string().optional(),
    /** Verified Resend sender for the admin login code, e.g. "予約管理 <login@example.com>". */
    RESEND_FROM: z.string().min(3).optional(),

    VAPID_PUBLIC_KEY: required(z.string().min(1)),
    VAPID_PRIVATE_KEY: required(z.string().min(1)),
    VAPID_SUBJECT: required(z.string().regex(/^(mailto:|https:\/\/)/)),

    CRON_SECRET: required(secret()),

    TURNSTILE_SITE_KEY: required(z.string().min(1)),
    /** When unset (development / test only) siteverify is skipped with a log line. */
    TURNSTILE_SECRET_KEY: required(z.string().min(1)),
    /**
     * Test-only siteverify endpoint (the E2E run points it at a local stub). Ignored on a Vercel
     * production deployment.
     */
    TURNSTILE_VERIFY_URL: z.url().optional(),

    /** HMAC key for IP / phone hashes in rate_limits, consents and audit_log (M-05). */
    PII_HASH_SECRET: required(secret()),

    SENTRY_DSN: z.string().optional(),
    SENTRY_CSP_REPORT_URI: z.url().optional(),
    /** `1` switches the public CSP from Report-Only to enforcing without a code change (SR-11). */
    CSP_ENFORCE: z.enum(['0', '1']).optional(),
  }
}

const mode = envMode(process.env)

export const env = createEnv({
  server: serverSchema(mode.strict),
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
  skipValidation: mode.skipValidation,
})

export const isProduction = env.VERCEL_ENV === 'production'
/** True in development / test / `next build` only: ephemeral secrets and the Turnstile skip. */
export const allowDevFallbacks = mode.allowDevFallbacks
