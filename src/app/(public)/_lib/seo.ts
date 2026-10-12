import type { Metadata } from 'next'
import { routing } from '@/lib/i18n/routing'

/**
 * Canonical + hreflang alternates for indexable public pages (01_sitemap.md §5.1):
 * canonical /{locale}{path}, languages ja / en / x-default (= ja).
 */
export function localeAlternates(locale: string, path: '' | `/${string}`): Metadata['alternates'] {
  const languages: Record<string, string> = {}
  for (const l of routing.locales) languages[l] = `/${l}${path}`
  languages['x-default'] = `/${routing.defaultLocale}${path}`
  return { canonical: `/${locale}${path}`, languages }
}

export function openGraph(locale: string, title: string, description?: string): Metadata['openGraph'] {
  return {
    type: 'website',
    siteName: 'Neuer Barber',
    title,
    description,
    locale: locale === 'ja' ? 'ja_JP' : 'en_US',
    alternateLocale: locale === 'ja' ? 'en_US' : 'ja_JP',
  }
}
