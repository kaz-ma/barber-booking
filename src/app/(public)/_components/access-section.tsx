import { useLocale, useTranslations } from 'next-intl'
import { ExternalButton } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { shop } from '@/config/shop'
import { formatRange, type HoursSummary } from '@/domain/hours'

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/**
 * AccessSection (DG-001 §5.2): map placeholder → card (name, 2-line address, walk, hours in 2
 * lines) → "地図を開く". Hours come from business_hours and settings.lead_time_min. No phone.
 */
export function AccessSection({ hours, leadTimeMin }: { hours: HoursSummary; leadTimeMin: number }) {
  const t = useTranslations('home')
  const tAvail = useTranslations('availability')
  const tc = useTranslations('common')
  const tNav = useTranslations('nav')
  const locale = useLocale() as 'ja' | 'en'
  const closed = hours.closedWeekdays.map((d) => tAvail(`weekdaysLong.${WEEKDAY_KEYS[d] ?? 'sun'}`))
  const ranges = hours.ranges.map((r) => formatRange(r, locale))
  return (
    <section className="sec" aria-labelledby="access-h">
      <div className="sec-head">
        <p className="caps" lang="en">
          {t('accessCaps')}
        </p>
        <h2 id="access-h">{t('accessHeading')}</h2>
      </div>
      <div className="map" role="img" aria-label={t('mapAlt')}>
        <span className="st" aria-hidden="true">
          {shop.access.station[locale]}
        </span>
        <span className="pin" aria-hidden="true">
          <b>{tNav('wordmark')}</b>
          <i />
        </span>
      </div>
      <div className="card access">
        <address className="addr">
          <b>{shop.name}</b>
          <span lang={locale === 'en' ? 'en' : 'ja'}>
            {shop.addressLines[locale][0]}
            <br />
            {shop.addressLines[locale][1]}
          </span>
        </address>
        <p className="walk">
          <Icon name="train" />
          {t('walk', { station: shop.access.station[locale], minutes: shop.access.walkMinutes })}
        </p>
        <p className="hrs">
          <Icon name="clock" />
          <span>
            <span className="nw">
              <i>{t('hoursLabel')}</i>
              <b className="num">{ranges.join(' / ')}</b>
            </span>
            <span className="sep" aria-hidden="true">
              ／
            </span>
            <span className="nw">
              <i>{t('closedLabel')}</i>
              <b>{closed.length > 0 ? closed.join(tc('listSep')) : t('noClosedDays')}</b>
            </span>
            <br />
            <span className="nw">
              <i>{t('leadLabel')}</i>
              {t.rich('leadValue', { minutes: leadTimeMin, b: (c) => <b className="num">{c}</b> })}
            </span>
          </span>
        </p>
      </div>
      <ExternalButton href={shop.mapUrl} variant="secondary" block icon="mapPin">
        {t('openMap')}
      </ExternalButton>
    </section>
  )
}
