import { useLocale, useTranslations } from 'next-intl'
import { ExternalButton } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { shop } from '@/config/shop'
import { formatRange, type HoursSummary } from '@/domain/hours'
import { AccessMap } from './access-map'

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/**
 * AccessSection (DG-001 §5.2): landmark map → card (name, postal code + 2-line address, walk,
 * hours in 2 lines) → nearest stations → directions → Google / Apple Maps (pinned at the
 * building's coordinates). Hours come from business_hours and settings.lead_time_min. No phone.
 */
export function AccessSection({ hours, leadTimeMin }: { hours: HoursSummary; leadTimeMin: number }) {
  const t = useTranslations('home')
  const tAvail = useTranslations('availability')
  const tc = useTranslations('common')
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
      <AccessMap />
      <div className="card access">
        <address className="addr">
          <b>{shop.name}</b>
          <span lang={locale === 'en' ? 'en' : 'ja'}>
            {t('postal', { code: shop.postalCode })}
            <br />
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
      <div className="card access-route">
        <h3>{t('stationsHeading')}</h3>
        <ul className="stations">
          {shop.access.stations.map((st) => (
            <li key={st.ja}>
              <span>{st[locale]}</span>
              <b>{t('stationWalk', { minutes: st.minutes })}</b>
            </li>
          ))}
        </ul>
        <h3>{t('routeHeading')}</h3>
        <ol className="steps">
          {(['routeStep1', 'routeStep2', 'routeStep3'] as const).map((k) => (
            <li key={k}>{t.rich(k, { b: (c) => <b>{c}</b> })}</li>
          ))}
        </ol>
        <p className="from-abeno">{t('routeFromAbeno')}</p>
        <p className="note">{t('walkNote')}</p>
      </div>
      <div className="map-buttons">
        <ExternalButton href={shop.mapUrl} variant="secondary" block icon="mapPin">
          {t('openMap')}
        </ExternalButton>
        <ExternalButton href={shop.appleMapUrl} variant="ghost" block icon="mapPin">
          {t('openAppleMap')}
        </ExternalButton>
      </div>
    </section>
  )
}
