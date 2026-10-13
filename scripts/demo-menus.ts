/**
 * npm run db:demo-menus -- on|off
 * Pre-launch demo only (DEMO_MODE=1). `on` makes every menu bookable with its price still
 * unset (0 → shown as "未定"), so the client can try the whole flow. `off` hides the menus that
 * still have no price, which is where they must be at launch (prelaunch checklist C2).
 * Menus with a real price are never touched by `off`, so admin edits survive.
 * The site caches menus: redeploy (or save any menu in 設定 > メニュー) to show the change.
 */
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { loadEnv } from './load-env'

loadEnv()

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
const mode = process.argv[2]
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}
if (mode !== 'on' && mode !== 'off') {
  console.error('usage: npm run db:demo-menus -- on|off')
  process.exit(1)
}

const pool = new Pool({ connectionString: url, options: '-c TimeZone=UTC' })
try {
  const db = drizzle(pool)
  const res =
    mode === 'on'
      ? await db.execute(sql`UPDATE menus SET is_active = true WHERE is_active = false`)
      : await db.execute(sql`UPDATE menus SET is_active = false WHERE is_active = true AND price_jpy = 0`)
  console.log(`demo menus ${mode}: ${res.rowCount ?? 0} menu(s) changed`)
} finally {
  await pool.end()
}
