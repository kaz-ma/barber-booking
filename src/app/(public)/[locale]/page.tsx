import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Footer } from '@/components/ui/footer'
import { SiteHeader } from '@/components/ui/header'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { openingHoursSpecification, summarizeHours } from '@/domain/hours'
import { getMenuCatalog, getWeeklyHours } from '@/features/booking/catalog'
import { MenuInfoCard } from '@/features/booking/components/menu-info-card'
import type { MenuPickerItem } from '@/features/booking/components/menu-picker'
import { getPublicSettings } from '@/features/settings/queries'
import { absoluteUrl } from '@/lib/site'
import { AccessSection } from '../_components/access-section'
import { BookingSection } from '../_components/booking-section'
import { Hero } from '../_components/hero'
import { JsonLd } from '../_components/json-ld'
import { localeAlternates, openGraph } from '../_lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('meta'), getLocale()])
  return {
    title: t('topTitle'),
    description: t('topDescription'),
    alternates: localeAlternates(locale, ''),
    openGraph: openGraph(locale, t('topTitle'), t('topDescription')),
  }
}

/**
 * S-C-01 top (DG-001 §5.10, 03_screen_specs v1.1): header → photo with a line on it, three
 * facts and the booking button → booking (① menu → ② date
 * & time → ③ details, all on this page) → access → languages → Instagram → footer. Menus, hours
 * and settings are cached reference data (static shell); availability is fetched by the
 * booking section from GET /api/availability. With no bookable menu the menu list is shown
 * read-only with the Instagram contact.
 */
export default async function TopPage() {
  const [t, tMenu, locale, menus, hoursRows, settings] = await Promise.all([
    getTranslations('home'),
    getTranslations('menu'),
    getLocale(),
    getMenuCatalog(),
    getWeeklyHours(),
    getPublicSettings(),
  ])
  const hours = summarizeHours(hoursRows)
  const bookable: MenuPickerItem[] = menus
    .filter((m) => m.isActive)
    .map((m) => ({
      slug: m.slug,
      name: m.name,
      description: m.description,
      durationMin: m.durationMin,
      priceJpy: m.priceJpy,
      priceStudentJpy: m.priceStudentJpy,
    }))
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: shop.name,
    alternateName: `${shop.name} ${shop.stylist.ja}`,
    url: absoluteUrl(`/${locale}`),
    image: absoluteUrl(shop.emblem.src as `/${string}`),
    address: { '@type': 'PostalAddress', ...shop.postalAddress },
    geo: { '@type': 'GeoCoordinates', ...shop.geo },
    openingHoursSpecification: openingHoursSpecification(hours),
    availableLanguage: ['ja', 'en'],
    sameAs: [shop.instagram.url],
  }

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="hero" aria-labelledby="hero-h">
          <h1 className="sr-only" id="hero-h">
            {t('h1')}
          </h1>
          <Hero hours={hours} />
        </section>

        <div className="wrap">
          {bookable.length > 0 ? (
            <BookingSection menus={bookable} leadTimeMin={settings.leadTimeMin} />
          ) : (
            <section className="sec" aria-labelledby="menu-h">
              <div className="sec-head">
                <p className="caps" lang="en">
                  {t('menuCaps')}
                </p>
                <h2 id="menu-h">{t('menuHeading')}</h2>
              </div>
              <div className="alert" role="status">
                <p>{tMenu('empty')}</p>
                <InstagramLink variant="button" />
              </div>
              <div className="menus">
                {menus.map((m) => (
                  <MenuInfoCard key={m.slug} menu={m} />
                ))}
              </div>
            </section>
          )}

          <AccessSection hours={hours} leadTimeMin={settings.leadTimeMin} />

          <section className="sec" aria-labelledby="lang-h">
            <div className="sec-head">
              <p className="caps" lang="en">
                {t('langCaps')}
              </p>
              <h2 id="lang-h">{t('langHeading')}</h2>
            </div>
            <dl className="kv">
              <div>
                <dt>{t('languagesLabel')}</dt>
                <dd>
                  {t.rich('languagesValue', {
                    en: (c) => <span lang="en">{c}</span>,
                    ja: (c) => <span lang="ja">{c}</span>,
                  })}
                </dd>
              </div>
              <div>
                <dt>{t('paymentLabel')}</dt>
                <dd>{t('paymentValue')}</dd>
              </div>
            </dl>
          </section>

          <InstagramLink variant="profile" className="mt-section" />
        </div>
      </main>
      <Footer />
      <JsonLd data={jsonLd} />
    </>
  )
}
