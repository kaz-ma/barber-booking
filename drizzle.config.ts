import { defineConfig } from 'drizzle-kit'
import { loadEnv } from './scripts/load-env'

// Same precedence as Next.js (.env.local, then .env). Config files are an
// allowed exception to the "process.env only in src/lib/env.ts" rule.
loadEnv()

// Migrations use the direct (unpooled) endpoint when available (DES-00 §4).
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? ''

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  // DZ-03: only `drizzle-kit migrate` is used; `push` ignores the hand-written constraints.
  strict: true,
  verbose: true,
})
