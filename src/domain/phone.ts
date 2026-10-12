/**
 * Phone normalization to E.164 (03_screen_specs.md §1.2, FR-C-05).
 * NFKC (full-width digits / plus / hyphen -> ASCII) -> strip spaces, hyphens and look-alike
 * dashes -> domestic JP numbers starting with 0 (10-11 digits) get +81.
 * Pure: shared by the client form and the server schema.
 */
const SEPARATORS = /[\s()\-.‐‑‒–—―−ーｰ]/g

export function normalizePhone(input: string): string {
  let s = input.normalize('NFKC').trim().replace(SEPARATORS, '')
  if (/^0\d{9,10}$/.test(s)) {
    s = `+81${s.slice(1)}`
  } else if (/^\+810\d{9,10}$/.test(s)) {
    // "+81 090 ..." — people often keep the domestic trunk 0 after the country code.
    s = `+81${s.slice(4)}`
  }
  return s
}

const E164 = /^\+[1-9]\d{7,14}$/
const JP = /^\+81[1-9]\d{8,9}$/

export function isValidE164(e164: string): boolean {
  if (!E164.test(e164)) return false
  return e164.startsWith('+81') ? JP.test(e164) : true
}

/** Last 4 digits, used only as HMAC input for audit_log.diff.phone_tail. */
export function phoneTail(e164: string): string {
  return e164.slice(-4)
}
