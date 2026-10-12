import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { LinkButton } from '@/components/ui/button'
import { MiniHeader } from '@/components/ui/header'
import { Icon } from '@/components/ui/icon'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { formatRange, summarizeHours } from '@/domain/hours'
import { getWeeklyHours } from '@/features/booking/catalog'
import { bookingSummary, CancelBookingCard } from '@/features/booking/components/booking-card'
import { CancelFlow } from '@/features/booking/components/cancel-flow'
import { type BookingByTokenDTO, getBookingByToken } from '@/features/booking/queries'
import { getPublicSettings } from '@/features/settings/queries'
import { formatDateTime } from '@/lib/i18n/display'
import { Link } from '@/lib/i18n/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('cancelTitle'), robots: { index: false, follow: false } }
}

/** S-C-06: shows the booking with no side effects; cancelling is a Server Action (POST). */
export default function CancelPage({ params }: PageProps<'/[locale]/cancel/[token]'>) {
  return (
    <>
      <MiniHeader />
      <main id="main" className="wrap pt-6 pb-12">
        <Suspense fallback={<div className="bk h-64" aria-hidden="true" />}>
          <CancelContent params={params} />
        </Suspense>
      </main>
    </>
  )
}

async function CancelContent({ params }: Pick<PageProps<'/[locale]/cancel/[token]'>, 'params'>) {
  await connection()
  const { token } = await params
  const [booking, locale, settings] = await Promise.all([getBookingByToken(token), getLocale(), getPublicSettings()])
  const lang = locale === 'en' ? 'en' : 'ja'
  // Same view for every failure reason (enumeration resistance, FR-S-06).
  if (!booking) return <InvalidView />

  const durationMin = Math.round((new Date(booking.end).getTime() - new Date(booking.start).getTime()) / 60_000)
  const deadlineLabel = formatDateTime(new Date(booking.deadline), lang)
  const pastDeadline = (
    <PastDeadlineView
      booking={booking}
      durationMin={durationMin}
      deadlineLabel={deadlineLabel}
      hours={settings.cancelDeadlineMin / 60}
    />
  )
  if (!booking.canCancel) return pastDeadline
  return (
    <CancelFlow
      token={token}
      locale={lang}
      summary={bookingSummary(booking, lang)}
      publicCode={booking.publicCode}
      deadlineLabel={deadlineLabel}
      card={<CancelBookingCard booking={booking} durationMin={durationMin} />}
      pastDeadline={pastDeadline}
      notFound={<InvalidView />}
    />
  )
}

/** (e) Invalid / used / expired token — reasons are never distinguished. */
async function InvalidView() {
  const [t, tNav, tErr] = await Promise.all([
    getTranslations('cancel'),
    getTranslations('nav'),
    getTranslations('errors'),
  ])
  return (
    <>
      <h1 className="title-24">{t('notFound')}</h1>
      <p className="mt-3">{t('notFoundBody')}</p>
      <div className="mt-6 grid gap-3">
        <LinkButton href="/book" variant="primary" block trailingIcon="arrowRight">
          {tNav('book')}
        </LinkButton>
        <InstagramLink variant="plain" />
      </div>
      <div className="center-row">
        <Link className="btn btn-ghost" href="/">
          {tErr('toTop')}
        </Link>
      </div>
    </>
  )
}

/** (d) Past the deadline: no cancel button; Instagram DM is the primary action (FR-C-12/16). */
async function PastDeadlineView({
  booking,
  durationMin,
  deadlineLabel,
  hours,
}: {
  booking: BookingByTokenDTO
  durationMin: number
  deadlineLabel: string
  hours: number
}) {
  const [t, tContact, locale, rows] = await Promise.all([
    getTranslations('cancel'),
    getTranslations('contact'),
    getLocale(),
    getWeeklyHours(),
  ])
  const summary = summarizeHours(rows)
  const range = summary.ranges[0]
  return (
    <>
      <h1 className="title-24">{t('heading')}</h1>
      <CancelBookingCard booking={booking} durationMin={durationMin} off />
      <div className="banner" role="status">
        <Icon name="alert" />
        <p>
          <b>{t('pastDeadlineTitle')}</b>
          <small>{t('pastDeadlineSub', { hours, deadline: deadlineLabel })}</small>
        </p>
      </div>
      <InstagramLink variant="primary" className="mt-4" />
      <p className="mt-2 text-center text-sm leading-relaxed text-fg-muted">
        <span className="nw">{tContact('dmTo', { handle: shop.instagram.handle })}</span>
        {range ? (
          <>
            {' ／ '}
            <span className="nw">{t('hours', { hours: formatRange(range, locale) })}</span>
          </>
        ) : null}
      </p>
    </>
  )
}
