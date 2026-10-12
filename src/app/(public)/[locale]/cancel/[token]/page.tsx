import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { ButtonLink } from '@/components/ui/button-link'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { BookingDetails } from '@/features/booking/components/booking-details'
import { CancelPanel } from '@/features/booking/components/cancel-panel'
import { getBookingByToken } from '@/features/booking/queries'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('cancelTitle'), robots: { index: false, follow: false } }
}

/** S-C-06: shows the booking with no side effects; cancelling is a Server Action (POST). */
export default function CancelPage({ params }: PageProps<'/[locale]/cancel/[token]'>) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-sm bg-bg-sunken" />}>
      <CancelContent params={params} />
    </Suspense>
  )
}

async function CancelContent({ params }: Pick<PageProps<'/[locale]/cancel/[token]'>, 'params'>) {
  await connection()
  const { token } = await params
  const [booking, t, tNav, format, locale] = await Promise.all([
    getBookingByToken(token),
    getTranslations('cancel'),
    getTranslations('nav'),
    getFormatter(),
    getLocale(),
  ])
  const instagram = <InstagramLink label={tNav('instagram', { handle: shop.instagram.handle })} />
  if (!booking) {
    // Same message for every failure reason (enumeration resistance, FR-S-06).
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t('notFound')}</h1>
        <ButtonLink href="/book">{tNav('book')}</ButtonLink>
      </div>
    )
  }
  const deadline = new Date(booking.deadline)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('heading')}</h1>
      <BookingDetails booking={booking} />
      {booking.canCancel ? (
        <>
          <p>
            {t('deadline', {
              deadline: `${format.dateTime(deadline, 'slotDate')} ${format.dateTime(deadline, 'slotTime')}`,
            })}
          </p>
          <CancelPanel token={token} locale={locale === 'en' ? 'en' : 'ja'} />
          <p className="text-sm text-fg-muted">{t('changeHint')}</p>
        </>
      ) : (
        <div role="alert" className="space-y-2">
          <PastDeadline />
          {instagram}
        </div>
      )}
    </div>
  )
}

async function PastDeadline() {
  const t = await getTranslations('contact')
  return <p>{t('pastDeadline')}</p>
}
