/**
 * ICS builder (S-C-07, 06_api.md §4). Pure function: the route handler supplies localized
 * strings and absolute URLs. RFC 5545: CRLF line endings, TEXT escaping, 75-octet folding.
 */
export type IcsInput = {
  uid: string
  start: Date
  end: Date
  summary: string
  location: string
  description: string
  url: string
  /** VALARM display text */
  alarmText: string
  now?: Date
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, ';').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function utcStamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

/** Fold lines longer than 75 octets (UTF-8 aware, never splitting a code point). */
function fold(line: string): string {
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

export function buildIcs(input: IcsInput): string {
  const alarm = (trigger: string) => [
    'BEGIN:VALARM',
    `TRIGGER:${trigger}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(input.alarmText)}`,
    'END:VALARM',
  ]
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neuer Barber//Booking//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${utcStamp(input.now ?? new Date())}`,
    `DTSTART:${utcStamp(input.start)}`,
    `DTEND:${utcStamp(input.end)}`,
    `SUMMARY:${escapeText(input.summary)}`,
    `LOCATION:${escapeText(input.location)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    `URL:${input.url}`,
    ...alarm('-P1D'),
    ...alarm('-PT1H'),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}
