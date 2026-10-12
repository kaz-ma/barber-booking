import { customType } from 'drizzle-orm/pg-core'

/** Always a finite, half-open range [start, end) (M-01). */
export type TstzRange = { start: Date; end: Date }

/**
 * `tstzrange` column (04_data_model.md §7). Prefer selecting `lower(during)` / `upper(during)`
 * as timestamptz (DZ-01) instead of relying on `fromDriver` string parsing, because the text
 * form depends on the session TimeZone (we pin it to UTC, DZ-02).
 */
export const tstzrange = customType<{ data: TstzRange; driverData: string }>({
  dataType: () => 'tstzrange',
  toDriver: ({ start, end }) => `[${start.toISOString()},${end.toISOString()})`,
  fromDriver: (value) => {
    // e.g. ["2026-11-04 09:00:00+00","2026-11-04 10:00:00+00")
    const m = /^\["?([^",]+)"?,"?([^",)]+)"?\)$/.exec(value)
    if (!m?.[1] || !m[2]) throw new Error('unexpected tstzrange literal')
    const iso = (s: string) => s.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')
    return { start: new Date(iso(m[1])), end: new Date(iso(m[2])) }
  },
})

/** `bytea` column mapped to a Node Buffer (token hashes, HMACs). */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
})
