import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { formatTimeRange } from '@/lib/i18n/format'
import type { BookingByTokenDTO } from '../queries'

/** Booking card shared by the done and cancel pages (JST, 24:00 rule, price snapshot). */
export async function BookingDetails({ booking }: { booking: BookingByTokenDTO }) {
  const [t, tMenu, format, locale] = await Promise.all([
    getTranslations('done'),
    getTranslations('menu'),
    getFormatter(),
    getLocale(),
  ])
  const start = new Date(booking.start)
  const end = new Date(booking.end)
  const time = formatTimeRange(start, end, locale, (d) => format.dateTime(d, 'slotTime'))
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-sm border border-border-subtle bg-bg-card p-4">
      <dt className="text-fg-muted">{t('publicCode')}</dt>
      <dd className="font-num font-bold tracking-widest">{booking.publicCode}</dd>
      <dt className="text-fg-muted">{t('date')}</dt>
      <dd className="font-num">
        {format.dateTime(start, 'full')} {time}
        {locale === 'en' ? ' JST' : ''}
      </dd>
      <dt className="text-fg-muted">{t('menu')}</dt>
      <dd>{booking.menuName[locale === 'en' ? 'en' : 'ja']}</dd>
      <dt className="text-fg-muted">{t('price')}</dt>
      <dd>
        {booking.priceJpy > 0 ? tMenu('price', { price: format.number(booking.priceJpy, 'jpy') }) : tMenu('priceTbd')}
        {booking.isStudent ? ` (${t('student')})` : ''}
      </dd>
    </dl>
  )
}
