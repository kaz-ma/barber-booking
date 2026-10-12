import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Footer } from '@/components/ui/footer'
import { SiteHeader } from '@/components/ui/header'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { getPublicSettings } from '@/features/settings/queries'
import { localeAlternates } from '../../_lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('meta'), getLocale()])
  return { title: t('tokushoTitle'), alternates: localeAlternates(locale, '/tokusho') }
}

/**
 * 特定商取引法に基づく表記 (requirements §12.4, decision G3): the phone number is disclosed on
 * request only (art. 11 proviso) — requests go to the Instagram DM. No phone number is shown.
 */
export default async function TokushoPage() {
  const [t, tDocs, settings] = await Promise.all([
    getTranslations('tokusho'),
    getTranslations('docs'),
    getPublicSettings(),
  ])
  const rows = t.raw('rows') as { k: string; v: string }[]
  const vars: Record<string, string> = {
    handle: shop.instagram.handle,
    hours: String(settings.cancelDeadlineMin / 60),
  }
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap pt-6">
        <article aria-labelledby="doc-h">
          <header className="doc-head">
            <p className="caps" lang="en">
              {t('caps')}
            </p>
            <h1 id="doc-h" className="title-24">
              {t('title')}
            </h1>
            <p className="ver">{tDocs('version', { version: t('version'), date: t('date') })}</p>
          </header>
          <p className="mt-4">{t('intro')}</p>
          <section className="pol" aria-labelledby="doc-h">
            <dl>
              {rows.map((r) => (
                <div key={r.k}>
                  <dt>{r.k}</dt>
                  <dd>{fill(r.v)}</dd>
                </div>
              ))}
            </dl>
            <InstagramLink variant="plain" className="mt-6" />
          </section>
        </article>
      </main>
      <Footer />
    </>
  )
}
