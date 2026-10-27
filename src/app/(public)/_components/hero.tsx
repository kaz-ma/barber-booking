import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Icon } from '@/components/ui/icon'
import { shop } from '@/config/shop'
import { formatRange, type HoursSummary } from '@/domain/hours'

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/**
 * Hero (S-C-01, DG-001 v0.5 "見やすさ優先", 2026-10-22): the photo full width with the warm
 * brown of the shop kept, a short line on top of it, then the facts people look for first
 * (hours, closing day, walk from the station) as plain text and one red button to the booking
 * section.
 * Until the client's photo arrives (U-01) the slot shows the CSS placeholder.
 */
export function Hero({ hours }: { hours: HoursSummary }) {
  const t = useTranslations('home')
  const tAvail = useTranslations('availability')
  const tc = useTranslations('common')
  const locale = useLocale() as 'ja' | 'en'
  const photo = shop.heroPhoto
  const ranges = hours.ranges.map((r) => formatRange(r, locale))
  const closed = hours.closedWeekdays.map((d) => tAvail(`weekdaysLong.${WEEKDAY_KEYS[d] ?? 'sun'}`))
  return (
    <>
      <div className="hero-media">
        {photo ? (
          <figure className="photo">
            <Image
              src={photo.src}
              width={photo.width}
              height={photo.height}
              alt={t('photoRealAlt')}
              priority
              sizes="100vw"
            />
          </figure>
        ) : (
          <figure className="photo photo-placeholder" role="img" aria-label={t('photoAlt')}>
            <figcaption aria-hidden="true">
              {t('photoCaption')}
              <span>{t('photoCaptionText')}</span>
            </figcaption>
          </figure>
        )}
        <div className="hero-copy">
          <p className="hero-eyebrow" lang="en">
            {t('heroEyebrow')}
          </p>
          <p className="hero-title">{t('heroTitle')}</p>
        </div>
      </div>
      <div className="wrap">
        {/* Plain text, not boxes: nothing here is tappable (DG-001 v0.7). */}
        <ul className="hero-info">
          <li>
            <Icon name="clock" />
            <span>
              {t('hoursLabel')} <b className="num">{ranges.join(' / ')}</b>
              <span className="sep" aria-hidden="true">
                ／
              </span>
              {t('closedLabel')} <b>{closed.length > 0 ? closed.join(tc('listSep')) : t('noClosedDays')}</b>
            </span>
          </li>
          <li>
            <Icon name="train" />
            <span>{t('walk', { station: shop.access.station[locale], minutes: shop.access.walkMinutes })}</span>
          </li>
        </ul>
        <a className="hero-cta" href="#book">
          {t('heroCta')}
          <span aria-hidden="true"> →</span>
        </a>
      </div>
    </>
  )
}
