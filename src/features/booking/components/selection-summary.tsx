'use client'

import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { applicablePrice, type Occupation } from '@/domain/pricing'
import type { BookingMenu } from './types'

/** Menu + date/time (+ price once occupation is known). Times are always shown in JST. */
export function SelectionSummary({
  menu,
  startsAt,
  occupation,
}: {
  menu: BookingMenu | undefined
  startsAt: string
  occupation?: Occupation | ''
}) {
  const t = useTranslations('confirm')
  const tMenu = useTranslations('menu')
  const format = useFormatter()
  const locale = useLocale()
  const start = new Date(startsAt)
  const end = new Date(start.getTime() + (menu?.durationMin ?? 0) * 60_000)
  const price = menu && occupation ? applicablePrice(menu, occupation) : undefined
  return (
    <dl className="mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-sm border border-border-subtle bg-bg-card p-4">
      <dt className="text-fg-muted">{t('menu')}</dt>
      <dd>{menu ? menu.name[locale as 'ja' | 'en'] : '—'}</dd>
      <dt className="text-fg-muted">{t('date')}</dt>
      <dd className="font-num">
        {format.dateTime(start, 'slotDate')} {format.dateTime(start, 'slotTime')}–{format.dateTime(end, 'slotTime')}
        {locale === 'en' ? ' JST' : ''}
      </dd>
      {price !== undefined ? (
        <>
          <dt className="text-fg-muted">{t('price')}</dt>
          <dd>{price > 0 ? tMenu('price', { price: format.number(price, 'jpy') }) : tMenu('priceTbd')}</dd>
        </>
      ) : null}
    </dl>
  )
}
