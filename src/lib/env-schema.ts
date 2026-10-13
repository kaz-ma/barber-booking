import { z } from 'zod'

/*
 * Environment schema and mode, without reading process.env (src/lib/env.ts does that, and
 * next.config.ts validates with the build phase it is given). Pure so it can be unit-tested.
 */

export type RawEnv = Record<string, string | undefined>

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
    /**
     * The single admin and the login-code delivery (FR-A-01). Required in production: without
     * them the OTP fallback silently sends nothing and a lost passkey locks the owner out.
     */
    ADMIN_EMAIL: required(z.email()),
    RESEND_API_KEY: required(z.string().min(1)),
    /** Verified Resend sender for the admin login code, e.g. "予約管理 <login@example.com>". */
    RESEND_FROM: required(z.string().min(3)),

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
    /**
     * `1` = demo / trial period before launch: every customer page shows a "test preview" banner
     * and asks search engines not to index. Read at build time, so change it with a redeploy.
     */
    DEMO_MODE: z.enum(['0', '1']).optional(),
  }
}

/** Validate a raw environment the same way env.ts does (used by next.config.ts with its phase). */
export function parseServerEnv(raw: RawEnv) {
  const mode = envMode(raw)
  const cleaned = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === '' ? undefined : v]))
  const schema = z.object(serverSchema(mode.strict))
  if (mode.skipValidation) return cleaned as unknown as z.output<typeof schema>
  const result = schema.safeParse(cleaned)
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((i) => i.path.join('.')))].join(', ')
    throw new Error(`Invalid environment variables: ${keys}`)
  }
  return result.data
}
