/** Canonical UUID text (8-4-4-4-12 hex). Route params are checked before any `::uuid` cast (CR-11). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}
