import { createEnv } from '@t3-oss/env-nextjs'
import { envMode, serverSchema } from './env-schema'

/**
 * Typed environment (DES-00 §4). This is the ONLY module allowed to read `process.env`
 * (Biome `noProcessEnv` enforces it; config files and scripts are the documented exceptions).
 *
 * Fail closed (SR-05): secrets are required whenever the app runs in production mode —
 * `NODE_ENV=production` on any platform (Vercel, Cloudflare, `next start`, Docker), plus Vercel
 * preview deployments. Only `next build` itself (NEXT_PHASE=phase-production-build; next.config.ts
 * exports it as soon as Next passes the phase) and development / test may run without them, so CI can
 * build without secrets and `npm run dev` / `npm test` work with only `DATABASE_URL`.
 * `SKIP_ENV_VALIDATION=1` is honoured outside production only.
 * Public values (VAPID public key, Turnstile site key) are passed from the server as props,
 * so there are no `NEXT_PUBLIC_` variables here (CON-05).
 */

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
