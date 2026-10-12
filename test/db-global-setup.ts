import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

/** Applies drizzle/ migrations (same journal as `drizzle-kit migrate`) to the test database. */
export default async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set. Run `npm test` (starts the local cluster) or export it.')
  }
  const pool = new Pool({ connectionString: url, options: '-c TimeZone=UTC' })
  try {
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle' })
  } finally {
    await pool.end()
  }
}
