import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { BackLink } from '@/components/ui/back-link'
import { LinkButton } from '@/components/ui/button'
import { FlowHeader } from '@/components/ui/header'
import { Icon } from '@/components/ui/icon'
import { InstagramLink } from '@/components/ui/instagram-link'
import { addDays, isDateString, isMonthString, jstDate, monthOf } from '@/domain/time'
import { MonthCalendar, MonthCalendarSkeleton } from '@/features/availability/components/month-calendar'
import { SlotList, slotHref } from '@/features/availability/components/slot-list'
import { SlotsFocus } from '@/features/availability/components/slots-focus'
import { getDayAvailability, getMonthAvailability } from '@/features/availability/queries'
import { BookingStepper, StepAnnouncer } from '@/features/booking/components/booking-stepper'
import { getActiveMenus, getPublicSettings } from '@/features/settings/queries'
import { formatDateLabel, formatTimeSpan } from '@/lib/i18n/display'
import { Link, redirect } from '@/lib/i18n/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('timeTitle'), robots: { index: false } }
}

/**
 * S-C-03 ② date & time. Static shell (header, stepper) + a dynamic hole under <Suspense>:
 * month day-states and the selected day's slots, read fresh on every request (D-04, never cached).
 */
export default async function BookTimePage({ searchParams }: PageProps<'/[locale]/book/time'>) {
  const [tSteps, tNav, tAvail] = await Promise.all([
    getTranslations('booking.steps'),
    getTranslations('nav'),
    getTranslations('availability'),
  ])
  return (
    <>
      <FlowHeader back={<BackLink href="/book" label={tNav('backToMenu')} />} />
      <main id="main" className="wrap">
        <BookingStepper current="time" />
        <StepAnnouncer current="time" />
        <h1 className="sr-only">{tSteps('time')}</h1>
        <Suspense fallback={<MonthCalendarSkeleton label={tAvail('loading')} />}>
          <AvailabilityHole searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  )
}

async function AvailabilityHole({ searchParams }: Pick<PageProps<'/[locale]/book/time'>, 'searchParams'>) {
  // Request-time only: "today", lead time and live bookings must never be prerendered.
  await connection()
  const sp = await searchParams
  const locale = await getLocale()
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '')
  const menuSlug = str('menu')
  if (!menuSlug) return redirect({ href: '/book', locale })

  const [menus, settings, t] = await Promise.all([
    getActiveMenus(),
    getPublicSettings(),
    getTranslations('availability'),
  ])
  const menu = menus.find((m) => m.slug === menuSlug)
  if (!menu) return redirect({ href: '/book', locale })

  const now = new Date()
  const today = jstDate(now)
  const lastDate = addDays(today, settings.maxAdvanceDays)
  // `date` wins; otherwise today is selected even if it has no free slot (OI-24).
  const dateParam = isDateString(str('date')) ? str('date') : ''
  const monthParam = isMonthString(str('month')) ? str('month') : ''
  const requestedMonth = monthParam || monthOf(dateParam || today)
  const month =
    (await getMonthAvailability({ menuSlug, month: requestedMonth }, now)) ??
    (await getMonthAvailability({ menuSlug, month: monthOf(today) }, now))
  if (!month) return redirect({ href: '/book', locale })

  // Moving months clears the selection (WF-C (f)); in the current month the default is today.
  const selectedDate =
    dateParam && monthOf(dateParam) === month.month
      ? dateParam
      : !monthParam && month.month === monthOf(today)
        ? today
        : null

  const keep: Record<string, string> = str('return') === 'confirm' ? { return: 'confirm' } : {}
  const selectedStartsAt = str('sel') || undefined
  const day = selectedDate ? await getDayAvailability({ menuSlug, date: selectedDate }, now) : null
  const openSlots = day?.slots.filter((s) => s.status === 'available') ?? []

  // "次に空いている日へ": the next ◎ day after the selection, in this month or the next.
  let nextAvailable: string | undefined
  if (selectedDate && openSlots.length === 0) {
    nextAvailable = month.days.find((d) => d.status === 'available' && d.date > selectedDate)?.date
    if (!nextAvailable && month.nextMonth) {
      const next = await getMonthAvailability({ menuSlug, month: month.nextMonth }, now)
      nextAvailable = next?.firstAvailableDate
    }
  }
  const monthHasOpen = month.days.some((d) => d.status === 'available')
  const selectedSlot = selectedStartsAt ? openSlots.find((s) => s.startsAt === selectedStartsAt) : undefined

  return (
    <>
      {str('taken') === '1' ? (
        <div className="alert" role="alert">
          <h2>
            <Icon name="alert" />
            {t('takenTitle')}
          </h2>
          <p>{t('takenBody')}</p>
        </div>
      ) : null}

      <div className="picked card">
        <p>
          {t.rich('picked', {
            menu: menu.name[locale === 'en' ? 'en' : 'ja'],
            minutes: menu.durationMin,
            b: (c) => <b>{c}</b>,
          })}
        </p>
        <Link className="btn btn-ghost" href={{ pathname: '/book', query: { menu: menuSlug } }}>
          {t('changeMenu')}
        </Link>
      </div>
      {locale === 'en' ? <p className="jst">{t('jstNote')}</p> : null}

      <MonthCalendar
        month={month.month}
        days={month.days}
        prevMonth={month.prevMonth}
        nextMonth={month.nextMonth}
        today={today}
        selectedDate={selectedDate}
        menuSlug={menuSlug}
        keep={keep}
      />
      <p className="legend">
        <span>
          <b className="o" aria-hidden="true">
            ◎
          </b>
          {t('legendOpen')}
        </span>
        <span aria-hidden="true">／</span>
        <span>
          <b className="x" aria-hidden="true">
            ×
          </b>
          {t('legendClosed')}
        </span>
      </p>
      <p className="deadline-note">
        <Icon name="clock" />
        {t('leadTime', { minutes: settings.leadTimeMin })}
      </p>
      {!month.nextMonth ? (
        <p className="deadline-note">
          {t('windowNote', { days: settings.maxAdvanceDays, date: formatDateLabel(lastDate, locale) })}
        </p>
      ) : null}

      {selectedDate ? (
        <>
          <div className="slots-head">
            <h2 id="slots-h" tabIndex={-1}>
              {t('selectedDate', { date: formatDateLabel(selectedDate, locale) })}
            </h2>
          </div>
          {openSlots.length > 0 ? (
            <SlotList
              slots={day?.slots ?? []}
              menuSlug={menuSlug}
              durationMin={menu.durationMin}
              selectedStartsAt={selectedSlot?.startsAt}
              keep={keep}
            />
          ) : (
            <div className="empty-day">
              <p>{t('noSlots')}</p>
              {nextAvailable ? (
                <>
                  <p>{t('nextAvailableDate', { date: formatDateLabel(nextAvailable, locale) })}</p>
                  <LinkButton
                    href={{
                      pathname: '/book/time',
                      query: { ...keep, menu: menuSlug, month: monthOf(nextAvailable), date: nextAvailable },
                    }}
                    scroll={false}
                    variant="secondary"
                    block
                    trailingIcon="arrowRight"
                  >
                    {t('nextAvailable')}
                  </LinkButton>
                </>
              ) : !monthHasOpen && month.nextMonth ? (
                <LinkButton
                  href={{ pathname: '/book/time', query: { ...keep, menu: menuSlug, month: month.nextMonth } }}
                  scroll={false}
                  variant="secondary"
                  block
                  trailingIcon="arrowRight"
                >
                  {t('nextMonthCta')}
                </LinkButton>
              ) : (
                <>
                  <p>{t('noSlotsMonth')}</p>
                  <InstagramLink variant="button" className="mt-3" />
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="slots-head">
          <h2 id="slots-h" tabIndex={-1} className="text-fg-muted">
            {monthHasOpen ? t('pickDay') : t('noSlotsMonth')}
          </h2>
        </div>
      )}

      {selectedSlot && selectedDate ? (
        <div className="sticky-cta paper">
          <div className="in">
            <p className="sum">
              <span>
                <b>{menu.name[locale === 'en' ? 'en' : 'ja']}</b>
              </span>
              <span>
                ／{' '}
                {t('proceedSummary', {
                  date: formatDateLabel(selectedDate, locale),
                  time: formatTimeSpan(
                    new Date(selectedSlot.startsAt),
                    new Date(new Date(selectedSlot.startsAt).getTime() + menu.durationMin * 60_000),
                    locale,
                  ),
                })}
              </span>
            </p>
            <LinkButton
              href={slotHref(menuSlug, selectedSlot.startsAt, keep)}
              variant="primary"
              block
              trailingIcon="arrowRight"
            >
              {t('proceed')}
            </LinkButton>
          </div>
        </div>
      ) : null}
      <SlotsFocus date={selectedDate} />
    </>
  )
}
