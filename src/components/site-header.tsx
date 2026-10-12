import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/lib/i18n/navigation'

/** Minimal header: shop name, language switch (to the same top page), booking CTA. */
export async function SiteHeader() {
  const t = await getTranslations('nav')
  const locale = await getLocale()
  const other = locale === 'ja' ? 'en' : 'ja'
  return (
    <header className="border-b border-border-subtle">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-bold tracking-wide">
          Neuer Barber
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/" locale={other} lang={other} aria-label={t('switchLocaleLabel')}>
            {t('switchLocale')}
          </Link>
          <Link href="/book" className="rounded-sm bg-accent px-3 py-2 text-on-accent">
            {t('book')}
          </Link>
        </nav>
      </div>
    </header>
  )
}
