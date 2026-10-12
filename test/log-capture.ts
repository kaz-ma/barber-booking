import { sql } from 'drizzle-orm'
import { vi } from 'vitest'
import { db } from '@/lib/db'

/** Run `fn` while capturing every console line (the logger writes JSON lines to console.*). */
export async function captureLogs<T>(fn: () => Promise<T>): Promise<{ value: T; lines: string[] }> {
  const lines: string[] = []
  const spies = (['error', 'warn', 'info', 'log', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    }),
  )
  try {
    return { value: await fn(), lines }
  } finally {
    for (const s of spies) s.mockRestore()
  }
}

/**
 * Temporarily make every `<timing>` on `table` fail with SQLSTATE P0001, i.e. an unexpected
 * database error raised while the statement's parameters (PII) are bound (CR-01 regression).
 */
export async function withFailingTrigger<T>(
  table: 'bookings' | 'customers' | 'consents',
  timing: 'BEFORE INSERT' | 'BEFORE UPDATE',
  fn: () => Promise<T>,
): Promise<T> {
  await db.execute(
    sql.raw(`CREATE OR REPLACE FUNCTION test_fail() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'simulated failure'; END $$`),
  )
  await db.execute(sql.raw(`CREATE TRIGGER test_fail ${timing} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_fail()`))
  try {
    return await fn()
  } finally {
    await db.execute(sql.raw(`DROP TRIGGER IF EXISTS test_fail ON ${table}`))
    await db.execute(sql.raw('DROP FUNCTION IF EXISTS test_fail()'))
  }
}
