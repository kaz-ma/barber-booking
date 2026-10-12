import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { cx } from '@/components/ui/cx'
import { formatDayOf, formatTimeSpan } from '@/lib/i18n/display'
import type { BookingByTokenDTO } from '../queries'
import { yenText } from './price'

/** "10月13日（火）19:00–20:00 カット" — used in the cancel dialog and the cancelled state. */
export function bookingSummary(booking: BookingByTokenDTO, locale: 'ja' | 'en'): string {
  const start = new Date(booking.start)
  const span = formatTimeSpan(start, new Date(booking.end), locale)
  return locale === 'ja'
    ? `${formatDayOf(start, locale)}${span} ${booking.menuName.ja}`
    : `${formatDayOf(start, locale)}, ${span} JST, ${booking.menuName.en}`
}

/** Big date + time block (Lato 36; 30 on /en where the 12-hour range is longer). */
export function BookingWhen({ booking }: { booking: BookingByTokenDTO }) {
  const locale = useLocale() as 'ja' | 'en'
  const start = new Date(booking.start)
  const [from, to] = formatTimeSpan(start, new Date(booking.end), locale).split('–')
  return (
    <p className="when">
      <span className="d">{formatDayOf(start, locale)}</span>
      <span className={cx('t', locale === 'en' && 'long')}>
        {from}
        <span>–</span>
        {to}
        {locale === 'en' ? <span className="text-base">JST</span> : null}
      </span>
    </p>
  )
}

/** Price with the student-rate tag (FR-C-04). Price 0 = not set yet (¥—). */
export function BookingPrice({ booking, className = 'p' }: { booking: BookingByTokenDTO; className?: string }) {
  const t = useTranslations('done')
  const tc = useTranslations('common')
  return (
    <span className="nw">
      <span className={className}>{yenText(booking.priceJpy)}</span>
      {booking.priceJpy ? null : <span className="sr-only">{tc('priceUnsetSr')}</span>}
      {booking.isStudent ? <span className="tag">{t('student')}</span> : null}
    </span>
  )
}

/**
 * The booking block of the cancel page (07_cancel comps): public code, double rule, date/time,
 * menu + duration, price. `off` = the muted variant used after the deadline.
 */
export function CancelBookingCard({
  booking,
  durationMin,
  off = false,
  children,
}: {
  booking: BookingByTokenDTO
  durationMin: number
  off?: boolean
  children?: ReactNode
}) {
  const t = useTranslations('done')
  const tCancel = useTranslations('cancel')
  const tMenu = useTranslations('menu')
  const tConfirm = useTranslations('confirm')
  const locale = useLocale() as 'ja' | 'en'
  return (
    <section className={cx('bk', off && 'off')} aria-label={tCancel('cardLabel')}>
      <dl className="code justify-start">
        <dt className="caps">{t('publicCode')}</dt>
        <dd>{booking.publicCode}</dd>
      </dl>
      <div className="rule2" aria-hidden="true" />
      <BookingWhen booking={booking} />
      <dl className="dkv">
        <div>
          <dt>{t('menu')}</dt>
          <dd>
            {booking.menuName[locale]}
            {locale === 'ja' ? '　' : ', '}
            {tMenu('duration', { minutes: durationMin })}
          </dd>
        </div>
        <div>
          <dt>{tConfirm('price')}</dt>
          <dd>
            <BookingPrice booking={booking} className="num" />
          </dd>
        </div>
      </dl>
      {children}
    </section>
  )
}
