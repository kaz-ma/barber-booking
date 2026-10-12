import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

/**
 * Typed environment (DES-00 §4). This is the ONLY module allowed to read `process.env`
 * (Biome `noProcessEnv` enforces it; config files and scripts are the documented exceptions).
 *
 * Secrets are required on deployed Vercel environments (production / preview incl. staging)
 * and optional locally so `npm run dev` / `npm test` work with only `DATABASE_URL`.
 * Public values (VAPID public key, Turnstile site key) are passed from the server as props,
 * so there are no `NEXT_PUBLIC_` variables here (CON-05).
 */
const vercelEnv = process.env.VERCEL_ENV
const isDeployed = vercelEnv === 'production' || vercelEnv === 'preview'

const secret = (min = 32) => z.string().min(min)
const requiredWhenDeployed = <T extends z.ZodType>(schema: T) =>
  isDeployed ? schema : schema.optional()

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
    VERCEL_URL: z.string().optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),

    /** Absolute origin without trailing slash, e.g. https://xxxx.vercel.app (FR-S-10). */
    SITE_URL: requiredWhenDeployed(
      z
        .url()
        .refine((v) => !v.endsWith('/'), 'SITE_URL must not end with a slash'),
    ),
    /** Pooled connection string (Neon `-pooler`) or the local cluster from scripts/db-local.sh. */
    DATABASE_URL: z.url(),
    /** Direct (unpooled) connection for migrations and pg_dump. Falls back to DATABASE_URL. */
    DATABASE_URL_UNPOOLED: z.url().optional(),

    BETTER_AUTH_SECRET: requiredWhenDeployed(secret()),
    ADMIN_EMAIL: z.email().optional(),
    RESEND_API_KEY: z.string().optional(),

    VAPID_PUBLIC_KEY: requiredWhenDeployed(z.string().min(1)),
    VAPID_PRIVATE_KEY: requiredWhenDeployed(z.string().min(1)),
    VAPID_SUBJECT: requiredWhenDeployed(z.string().regex(/^(mailto:|https:\/\/)/)),

    CRON_SECRET: requiredWhenDeployed(secret()),

    TURNSTILE_SITE_KEY: requiredWhenDeployed(z.string().min(1)),
    /** When unset (local/dev/test only) siteverify is skipped with a log line. */
    TURNSTILE_SECRET_KEY: requiredWhenDeployed(z.string().min(1)),

    /** HMAC key for IP / phone hashes in rate_limits and audit_log (M-05). */
    PII_HASH_SECRET: requiredWhenDeployed(secret()),

    SENTRY_DSN: z.string().optional(),
    SENTRY_CSP_REPORT_URI: z.url().optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === '1',
})

export const isProduction = env.VERCEL_ENV === 'production'
