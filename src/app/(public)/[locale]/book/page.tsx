import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { BackLink } from '@/components/ui/back-link'
import { FlowHeader } from '@/components/ui/header'
import { Icon } from '@/components/ui/icon'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { getMenuCatalog } from '@/features/booking/catalog'
import { BookingStepper, StepAnnouncer } from '@/features/booking/components/booking-stepper'
import { MenuStep, type MenuStepItem } from '@/features/booking/components/menu-step'
import { getActiveMenus, getPublicSettings } from '@/features/settings/queries'
import { localeAlternates, openGraph } from '../../_lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('meta'), getLocale()])
  return {
    title: t('bookTitle'),
    description: t('bookDescription'),
    alternates: localeAlternates(locale, '/book'),
    openGraph: openGraph(locale, t('bookTitle'), t('bookDescription')),
  }
}

/**
 * S-C-02 ① menu — the single entry into booking (OI-25). Menus are cached reference data;
 * the selection is client state mirrored to ?menu= and the draft.
 */
export default async function BookMenuPage() {
  const [active, catalog, settings, t, tSteps, tc] = await Promise.all([
    getActiveMenus(),
    getMenuCatalog(),
    getPublicSettings(),
    getTranslations('menu'),
    getTranslations('booking.steps'),
    getTranslations('common'),
  ])
  const menus: MenuStepItem[] = active.map((m) => ({
    slug: m.slug,
    name: m.name,
    durationMin: m.durationMin,
    priceJpy: m.priceJpy,
    priceStudentJpy: m.priceStudentJpy,
    description: catalog.find((c) => c.slug === m.slug)?.description ?? m.description,
  }))
  return (
    <>
      <FlowHeader back={<BackLink href="/" label={tc('toTop')} />} />
      <main id="main" className="wrap">
        <BookingStepper current="menu" />
        <StepAnnouncer current="menu" />
        <h1 className="page-h" id="menu-step-h">
          {tSteps('menu')}
        </h1>
        {menus.length === 0 ? (
          <div className="alert" role="status">
            <p>{t('empty')}</p>
            <InstagramLink variant="button" />
          </div>
        ) : (
          <>
            <p className="lead">{t('lead')}</p>
            <Suspense fallback={null}>
              <MenuStep menus={menus} />
            </Suspense>
          </>
        )}
        <details className="acc">
          <summary>
            {t('policyDigestTitle')}
            <Icon name="chevronDown" />
          </summary>
          <p>{t('policyDigest', { hours: settings.cancelDeadlineMin / 60, handle: shop.instagram.handle })}</p>
        </details>
      </main>
    </>
  )
}
