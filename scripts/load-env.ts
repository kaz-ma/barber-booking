import { existsSync } from 'node:fs'

/**
 * Load .env.local then .env for CLI tools (drizzle-kit, tsx scripts), mirroring the Next.js
 * precedence. process.loadEnvFile never overrides variables that are already set, so real
 * environment variables (CI, Vercel) always win.
 */
export function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) process.loadEnvFile(file)
  }
}
