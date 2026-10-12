'use client'

import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type ComponentProps, Suspense } from 'react'
import { Link, usePathname } from '@/lib/i18n/navigation'

/**
 * "EN" / "日本語" (FR-C-13): the same page in the other locale, keeping the query string
 * (menu, date, …). The booking draft survives the switch in sessionStorage. Path and query are
 * request data on dynamic routes, so they stream in under <Suspense>; the prerendered fallback
 * points at the other locale's top page.
 */
export function LocaleSwitch() {
  return (
    <Suspense fallback={<Switch href="/" />}>
      <SamePage />
    </Suspense>
  )
}

function SamePage() {
  const pathname = usePathname()
  const params = useSearchParams()
  const query = Object.fromEntries(params.entries())
  return <Switch href={Object.keys(query).length > 0 ? { pathname, query } : pathname} />
}

function Switch({ href }: { href: ComponentProps<typeof Link>['href'] }) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const other = locale === 'ja' ? 'en' : 'ja'
  return (
    <Link
      href={href}
      locale={other}
      lang={other}
      hrefLang={other}
      aria-label={t('switchLocaleLabel')}
      className="lang"
      prefetch={false}
    >
      {t('switchLocale')}
    </Link>
  )
}
