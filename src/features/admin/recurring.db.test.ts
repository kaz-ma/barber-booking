import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { queryAvailabilityDays } from '@/lib/db/availability-sql'
import { insertNamedBooking, jst, resetDb } from '../../../test/db-helpers'
import {
  createRecurringBlock,
  deleteRecurringBlock,
  listRecurringBlocks,
  materializeRecurringBlocks,
} from './recurring'

/* B7 毎週の休み (2026-10-18) against a real Postgres. */

const NOW = jst('2026-11-03 12:00') // a Tuesday

const days = async () =>
  (
    await db.execute<{ d: string }>(sql`
      SELECT to_char(lower(during) AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI') AS d
      FROM time_blocks WHERE deleted_at IS NULL AND recurring_id IS NOT NULL ORDER BY 1`)
  ).rows.map((r) => r.d)

beforeEach(resetDb)

describe('recurring blocks', () => {
  it('fills matching open days up to the booking horizon, skipping booked days', async () => {
    await insertNamedBooking(jst('2026-11-10 21:00'), jst('2026-11-10 22:00'))
    const res = await createRecurringBlock(
      { weekdays: [2], startMin: 21 * 60, endMin: 21 * 60 + 30, kind: 'break', label: '休憩' },
      { now: NOW },
    )
    expect(res.status).toBe('ok')
    const d = await days()
    expect(d[0]).toBe('2026-11-03 21:00')
    expect(d).not.toContain('2026-11-10 21:00')
    expect(d.every((x) => new Date(`${x.replace(' ', 'T')}:00+09:00`).getUTCDay() === 2)).toBe(true)
    // max_advance_days = 60 → Tuesdays up to 2027-01-02 minus the booked one.
    expect(d.at(-1)).toBe('2026-12-29 21:00')
    expect(await listRecurringBlocks()).toEqual([
      expect.objectContaining({ weekdays: [2], startMin: 1260, endMin: 1290, kind: 'break', label: '休憩' }),
    ])
  })

  it('a deleted day is not recreated by the nightly top-up; stopping the rule removes the future days', async () => {
    const res = await createRecurringBlock({ weekdays: [3], startMin: 1260, endMin: 1290, kind: 'break' }, { now: NOW })
    if (res.status !== 'ok') throw new Error('expected ok')
    await db.execute(sql`UPDATE time_blocks SET deleted_at = now()
      WHERE lower(during) = ${jst('2026-11-04 21:00').toISOString()}::timestamptz`)
    expect(await materializeRecurringBlocks(NOW)).toBe(0)
    expect(await days()).not.toContain('2026-11-04 21:00')
    // A week later the horizon moves one week further.
    expect(await materializeRecurringBlocks(jst('2026-11-10 12:00'))).toBe(1)

    const stop = await deleteRecurringBlock(res.data.ruleId, { now: jst('2026-11-20 12:00') })
    expect(stop.status).toBe('ok')
    expect(await days()).toEqual(['2026-11-11 21:00', '2026-11-18 21:00'])
    expect(await listRecurringBlocks()).toEqual([])
  })

  it('the generated breaks close those times for customers', async () => {
    await createRecurringBlock({ weekdays: [2], startMin: 18 * 60, endMin: 24 * 60, kind: 'closed' }, { now: NOW })
    const [day] = await queryAvailabilityDays(db, { menuSlug: 'cut', from: '2026-11-10', to: '2026-11-10', now: NOW })
    expect(day?.status).not.toBe('available')
  })
})
