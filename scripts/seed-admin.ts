/**
 * npm run db:seed-admin
 * Creates (or keeps) the single admin user from ADMIN_EMAIL in DATABASE_URL (FR-A-01, ADR-0006).
 * Sign-up is disabled in Better Auth, so this is the only way an account comes to exist.
 * First login: "メールのコードでログイン" (6-digit code), then register a passkey in 設定 > 通知.
 */
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { loadEnv } from './load-env'

loadEnv()

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
if (!url) {
  console.error('DATABASE_URL is not set (run `npm run db:start` to create .env.local)')
  process.exit(1)
}
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error('ADMIN_EMAIL is not set or invalid (add it to .env.local / Vercel env)')
  process.exit(1)
}

const pool = new Pool({ connectionString: url, options: '-c TimeZone=UTC' })
try {
  const db = drizzle(pool)
  const res = await db.execute<{ id: string }>(sql`
    INSERT INTO auth_user (id, name, email, email_verified)
    VALUES (${randomUUID()}, 'Owner', ${email}, true)
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `)
  const others = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM auth_user WHERE email <> ${email}`)
  console.log(res.rows.length > 0 ? 'admin user created' : 'admin user already exists')
  if ((others.rows[0]?.n ?? 0) > 0) {
    console.warn('warning: other auth_user rows exist; requireAdmin() only accepts ADMIN_EMAIL')
  }
} finally {
  await pool.end()
}
