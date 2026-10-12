/**
 * npm run db:seed [-- --activate-menus]
 * Seeds menus (inactive, price 0 until OI-01), business hours and settings into DATABASE_URL.
 * `--activate-menus` makes the 9 menus bookable for local development only.
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../src/lib/db/schema'
import { seedReferenceData } from '../src/lib/db/seed'
import { loadEnv } from './load-env'

loadEnv()

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set (run `npm run db:start` to create .env.local)')
  process.exit(1)
}

const activateMenus = process.argv.includes('--activate-menus')
const pool = new Pool({ connectionString: url, options: '-c TimeZone=UTC' })
try {
  await seedReferenceData(drizzle(pool, { schema }), {
    activateMenus,
    adminEmail: process.env.ADMIN_EMAIL,
  })
  console.log(`seeded reference data${activateMenus ? ' (menus activated for local dev)' : ''}`)
} finally {
  await pool.end()
}
