import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { isDateString, isMonthString, jstDate, monthOf } from '@/domain/time'
import { MonthCalendar } from '@/features/availability/components/month-calendar'
import { SlotList } from '@/features/availability/components/slot-list'
import { getDayAvailability, getMonthAvailability } from '@/features/availability/queries'
import { BookingStepper } from '@/features/booking/components/booking-stepper'
import { getPublicSettings } from '@/features/settings/queries'
import { redirect } from '@/lib/i18n/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('timeTitle') }
}

/**
 * S-C-03. Static shell (stepper, legend, deadline notice) + dynamic hole under <Suspense>:
 * month day-states and the selected day's slots, read fresh on every request (D-04).
 */
export default async function BookTimePage({ searchParams }: PageProps<'/[locale]/book/time'>) {
  const [t, tSteps, settings] = await Promise.all([
    getTranslations('availability'),
    getTranslations('booking.steps'),
    getPublicSettings(),
  ])
  return (
    <>
      <BookingStepper current="time" />
      <h1 className="mb-2 text-2xl font-bold">{tSteps('time')}</h1>
      <p className="mb-1 text-sm">
        <span className="text-status-open">{t('legendOpen')}</span> ／{' '}
        <span className="text-fg-subtle">{t('legendClosed')}</span>
      </p>
      <p className="mb-4 text-sm text-fg-muted">
        {t('leadTime', { minutes: settings.leadTimeMin })} {t('jstNote')}
      </p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-sm bg-bg-sunken" />}>
        <AvailabilityHole searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function AvailabilityHole({ searchParams }: Pick<PageProps<'/[locale]/book/time'>, 'searchParams'>) {
  // Request-time only: "today", lead time and live bookings must never be prerendered.
  await connection()
  const sp = await searchParams
  const locale = await getLocale()
  const menuSlug = typeof sp.menu === 'string' ? sp.menu : ''
  if (!menuSlug) redirect({ href: '/book', locale })

  const now = new Date()
  const today = jstDate(now)
  // `date` wins; otherwise today is selected even if it has no free slot (OI-24).
  const date = typeof sp.date === 'string' && isDateString(sp.date) ? sp.date : today
  const requestedMonth = typeof sp.month === 'string' && isMonthString(sp.month) ? sp.month : monthOf(date)
  const selectedDate = monthOf(date) === requestedMonth ? date : `${requestedMonth}-01`

  const month =
    (await getMonthAvailability({ menuSlug, month: requestedMonth }, now)) ??
    (await getMonthAvailability({ menuSlug, month: monthOf(today) }, now))
  if (!month) redirect({ href: '/book', locale }) // unknown / inactive menu

  const day = await getDayAvailability({ menuSlug, date: selectedDate }, now)
  const [t, format] = await Promise.all([getTranslations('availability'), getFormatter()])
  return (
    <>
      {month ? <MonthCalendar data={month} menuSlug={menuSlug} selectedDate={selectedDate} /> : null}
      <h2 className="mb-3 font-bold">
        {t('selectedDate', { date: format.dateTime(new Date(`${selectedDate}T12:00:00+09:00`), 'slotDate') })}
      </h2>
      <SlotList slots={day?.slots ?? []} menuSlug={menuSlug} />
    </>
  )
}
