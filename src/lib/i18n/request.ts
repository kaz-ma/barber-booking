import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { TIME_ZONE } from '@/domain/time'
import { formatsFor } from './formats'
import { routing } from './routing'

/*
 * next-intl request config (ADR-0005). The locale comes from an explicit argument
 * (getTranslations({ locale }) in route handlers / admin) or the `[locale]` root param.
 * `next/root-params` is the Cache Components friendly replacement for setRequestLocale.
 */
export default getRequestConfig(async ({ locale: explicit }) => {
  let requested: string | undefined = explicit
  if (!requested) {
    const { locale: rootLocale } = await import('next/root-params')
    requested = await rootLocale()
  }
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  return {
    locale,
    timeZone: TIME_ZONE,
    formats: formatsFor(locale),
    messages: (await import(`../../../messages/${locale}.json`)).default,
  }
})
