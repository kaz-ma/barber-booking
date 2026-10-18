import { escapeText, fold, utcStamp } from '@/lib/ics-text'

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

export { escapeText }

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
