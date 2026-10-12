import { POLICY } from '@/config/shop'

/** Effective date of the policies in the page locale (ja: 2026年11月1日, en: November 1, 2026). */
export function policyDateLabel(locale: string): string {
  const [y, m, d] = POLICY.effectiveDate.split('-').map(Number) as [number, number, number]
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}
