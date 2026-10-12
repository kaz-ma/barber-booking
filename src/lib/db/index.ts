import 'server-only'
import { attachDatabasePool } from '@vercel/functions'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '@/lib/env'
import * as schema from './schema'
import { installDbErrorScrubber } from './scrub-errors'

// CR-01: database errors never carry SQL parameters (PII) out of the data layer.
installDbErrorScrubber()

/*
 * One driver everywhere: node-postgres Pool (DZ-05, ADR-0002). Locally it talks to the
 * cluster from scripts/db-local.sh; on Vercel it uses Neon's pooled connection string
 * (`...-pooler...?sslmode=require`). The HTTP driver is not used because booking needs an
 * interactive transaction (advisory lock -> re-check -> INSERT) on one connection.
 */
function createPool(): Pool {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === 'test' ? 10 : 5,
    idleTimeoutMillis: 10_000,
    // DZ-02: pin the session TimeZone so range literals / timestamptz text are stable.
    options: '-c TimeZone=UTC',
  })
  // Fluid compute: release idle clients before the function instance is suspended.
  attachDatabasePool(pool)
  return pool
}

const globalForDb = globalThis as unknown as { __bbPool?: Pool }
export const pool: Pool = globalForDb.__bbPool ?? createPool()
// Reuse across dev HMR reloads; tests get a fresh pool per file (closed in test/db-setup.ts).
if (env.NODE_ENV === 'development') globalForDb.__bbPool = pool

export const db = drizzle(pool, { schema })
export type Db = typeof db
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
/** Either the pool-backed db or an open transaction. */
export type DbOrTx = Db | Tx
