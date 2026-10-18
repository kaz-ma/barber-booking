/** RFC 5545 text helpers shared by the customer .ics and the owner's calendar feed. Pure. */

/** RFC 5545 §3.3.11 TEXT: backslash first, then `;` `,` and every line break (CRLF, LF, CR) (CR-12). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

export function utcStamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

/** Fold lines longer than 75 octets (UTF-8 aware, never splitting a code point). */
export function fold(line: string): string {
  const encoder = new TextEncoder()
  const out: string[] = []
  let current = ''
  let currentBytes = 0
  for (const ch of line) {
    const bytes = encoder.encode(ch).length
    const limit = out.length === 0 ? 75 : 74 // continuation lines start with a space
    if (currentBytes + bytes > limit) {
      out.push(current)
      current = ''
      currentBytes = 0
    }
    current += ch
    currentBytes += bytes
  }
  out.push(current)
  return out.join('\r\n ')
}
