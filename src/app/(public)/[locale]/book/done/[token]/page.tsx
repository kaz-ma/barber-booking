import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { ButtonLink } from '@/components/ui/button-link'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { BookingDetails } from '@/features/booking/components/booking-details'
import { getBookingByToken } from '@/features/booking/queries'
import { getPublicSettings } from '@/features/settings/queries'
import { absoluteUrl } from '@/lib/site'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('doneTitle'), robots: { index: false, follow: false } }
}

/** S-C-05: the customer's only receipt (no email). Token-dependent, never cached. */
export default function DonePage({ params }: PageProps<'/[locale]/book/done/[token]'>) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-sm bg-bg-sunken" />}>
      <DoneContent params={params} />
    </Suspense>
  )
}

async function DoneContent({ params }: Pick<PageProps<'/[locale]/book/done/[token]'>, 'params'>) {
  await connection()
  const { token } = await params
  const [booking, t, tNav, locale, settings] = await Promise.all([
    getBookingByToken(token),
    getTranslations('done'),
    getTranslations('nav'),
    getLocale(),
    getPublicSettings(),
  ])
  if (!booking) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t('notFound')}</h1>
        <ButtonLink href="/book">{tNav('book')}</ButtonLink>
        <p>
          <InstagramLink label={tNav('instagram', { handle: shop.instagram.handle })} />
        </p>
      </div>
    )
  }
  const cancelUrl = absoluteUrl(`/${locale}/cancel/${token}`)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">✓ {t('heading')}</h1>
      <p className="text-sm">{t('screenshot')}</p>
      <BookingDetails booking={booking} />
      <p>
        {shop.name}
        <br />
        <span lang="ja">{shop.address.ja}</span>{' '}
        <a href={shop.mapUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Map
        </a>
      </p>
      <a
        href={`/api/ics/${token}`}
        className="flex min-h-11 items-center justify-center rounded-sm border border-border bg-bg-card px-4"
      >
        {t('addToCalendar')}
      </a>
      <section>
        <h2 className="font-bold">{t('cancelLink')}</h2>
        <a href={cancelUrl} className="break-all underline">
          {cancelUrl}
        </a>
        <p className="text-sm text-fg-muted">{t('cancelHelp', { hours: settings.cancelDeadlineMin / 60 })}</p>
      </section>
      <p>
        <InstagramLink label={tNav('instagram', { handle: shop.instagram.handle })} />
      </p>
    </div>
  )
}
