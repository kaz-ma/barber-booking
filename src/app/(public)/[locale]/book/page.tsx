import type { Metadata } from 'next'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { BookingStepper } from '@/features/booking/components/booking-stepper'
import { getActiveMenus } from '@/features/settings/queries'
import { Link } from '@/lib/i18n/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('bookTitle') }
}

/** S-C-02: menu step. Menus come from the cached static shell; selection moves to ?menu=. */
export default async function BookMenuPage() {
  const [menus, t, tSteps, format, locale] = await Promise.all([
    getActiveMenus(),
    getTranslations('menu'),
    getTranslations('booking.steps'),
    getFormatter(),
    getLocale(),
  ])
  return (
    <>
      <BookingStepper current="menu" />
      <h1 className="mb-4 text-2xl font-bold">{tSteps('menu')}</h1>
      {menus.length === 0 ? (
        <p>
          {t('empty')} <InstagramLink label={`@${shop.instagram.handle}`} />
        </p>
      ) : (
        <ul className="space-y-3">
          {menus.map((m) => (
            <li key={m.slug}>
              <Link
                href={{ pathname: '/book/time', query: { menu: m.slug } }}
                className="block rounded-sm border border-border bg-bg-card p-4 hover:border-accent"
              >
                <span className="block text-lg font-bold">{m.name[locale]}</span>
                <span className="block text-sm text-fg-muted">
                  {t('duration', { minutes: m.durationMin })} ·{' '}
                  {m.priceJpy > 0 ? t('price', { price: format.number(m.priceJpy, 'jpy') }) : t('priceTbd')}
                  {m.priceStudentJpy !== null && m.priceJpy > 0
                    ? ` · ${t('studentPrice', { price: format.number(m.priceStudentJpy, 'jpy') })}`
                    : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
