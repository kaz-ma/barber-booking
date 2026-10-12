import { defineRouting } from 'next-intl/routing'

/** ADR-0005: always-prefixed locales; `/` alone negotiates (cookie -> Accept-Language -> ja). */
export const routing = defineRouting({
  locales: ['ja', 'en'],
  defaultLocale: 'ja',
  localePrefix: 'always',
  localeDetection: true,
  localeCookie: { name: 'NEXT_LOCALE', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' },
  alternateLinks: true,
})

export type AppLocale = (typeof routing.locales)[number]
