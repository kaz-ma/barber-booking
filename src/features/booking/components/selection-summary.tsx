'use client'

import { useLocale, useTranslations } from 'next-intl'
import { applicablePrice, isStudentRateApplied, type Occupation } from '@/domain/pricing'
import { formatDayOf, formatTimeSpan } from '@/lib/i18n/display'
import { Link } from '@/lib/i18n/navigation'
import { yenText } from './price'
import type { BookingMenu } from './types'

/**
 * SelectionSummary (S-C-02b): two rows — menu (+ applicable price, recalculated for students,
 * FR-C-04) and date/time — each with a "変更" ghost link naming its target. Times are JST.
 */
export function SelectionSummary({
  menu,
  startsAt,
  occupation,
}: {
  menu: BookingMenu
  startsAt: string
  occupation: Occupation | ''
}) {
  const t = useTranslations('booking.form')
  const tMenu = useTranslations('menu')
  const tAvail = useTranslations('availability')
  const tc = useTranslations('common')
  const locale = useLocale() as 'ja' | 'en'
  const start = new Date(startsAt)
  const end = new Date(start.getTime() + menu.durationMin * 60_000)
  const date = startsAt.slice(0, 10)
  const isStudentRate = occupation === 'student' && isStudentRateApplied(menu, occupation)
  const price = applicablePrice(menu, occupation || 'worker')
  const duration = tMenu('duration', { minutes: menu.durationMin })
  return (
    <>
      <section className="card recap" aria-label={t('selection')}>
        <div className="r">
          <p>
            <b>{menu.name[locale]}</b>
            <span className="nw">{locale === 'ja' ? `（${duration}）` : ` (${duration})`}</span>
            <span className="nw">
              {isStudentRate
                ? t('studentPriceLine', { price: yenText(price) })
                : t('generalPriceLine', { price: yenText(price) })}
            </span>
          </p>
          <Link
            className="btn btn-ghost"
            href={{ pathname: '/book', query: { menu: menu.slug } }}
            aria-label={t('changeMenu')}
          >
            {tc('change')}
          </Link>
        </div>
        <div className="r">
          <p>
            <span className="nw">{formatDayOf(start, locale)}</span>{' '}
            <span className="nw">
              {formatTimeSpan(start, end, locale)}
              {locale === 'en' ? ' JST' : ''}
            </span>
          </p>
          <Link
            className="btn btn-ghost"
            href={{ pathname: '/book/time', query: { menu: menu.slug, date, sel: startsAt } }}
            aria-label={t('changeTime')}
          >
            {tc('change')}
          </Link>
        </div>
      </section>
      {locale === 'en' ? <p className="jst">{tAvail('jstNote')}</p> : null}
    </>
  )
}
