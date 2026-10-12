import type { Formats } from 'next-intl'

/** Shared date/number formats (01_sitemap.md §4.1). en uses a 12-hour clock. */
export function formatsFor(locale: string) {
  return {
    dateTime: {
      slotDate: { month: 'numeric', day: 'numeric', weekday: 'short' },
      slotTime: { hour: 'numeric', minute: '2-digit', hour12: locale === 'en' },
      full: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' },
      monthTitle: { year: 'numeric', month: 'long' },
    },
    number: { jpy: { style: 'currency', currency: 'JPY' } },
  } satisfies Formats
}
