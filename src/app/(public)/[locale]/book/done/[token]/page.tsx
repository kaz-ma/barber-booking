import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { ExternalButton, LinkButton } from '@/components/ui/button'
import { CopyButton, ShareCopyButton } from '@/components/ui/copy-button'
import { FocusOnMount } from '@/components/ui/focus-on-mount'
import { MiniHeader } from '@/components/ui/header'
import { Icon } from '@/components/ui/icon'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { BookingPrice, BookingWhen } from '@/features/booking/components/booking-card'
import { getBookingByToken } from '@/features/booking/queries'
import { getPublicSettings } from '@/features/settings/queries'
import { Link } from '@/lib/i18n/navigation'
import { absoluteUrl } from '@/lib/site'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('doneTitle'), robots: { index: false, follow: false } }
}

/**
 * S-C-05 — the customer's only receipt (no email), laid out to fit 390×844 without scrolling
 * (base/03_done). Token-dependent, never cached.
 */
export default function DonePage({ params }: PageProps<'/[locale]/book/done/[token]'>) {
  return (
    <>
      <MiniHeader />
      <main id="main" className="wrap pt-6">
        <Suspense fallback={<div className="done-card h-[560px]" aria-hidden="true" />}>
          <DoneContent params={params} />
        </Suspense>
      </main>
    </>
  )
}

async function DoneContent({ params }: Pick<PageProps<'/[locale]/book/done/[token]'>, 'params'>) {
  await connection()
  const { token } = await params
  const [booking, t, tMenu, tNav, tc, locale, settings] = await Promise.all([
    getBookingByToken(token),
    getTranslations('done'),
    getTranslations('menu'),
    getTranslations('nav'),
    getTranslations('common'),
    getLocale(),
    getPublicSettings(),
  ])
  const lang = locale === 'en' ? 'en' : 'ja'

  if (!booking) {
    return (
      <div className="pb-12">
        <h1 className="title-24" id="done-h" tabIndex={-1}>
          {t('notFound')}
        </h1>
        <p className="mt-2 text-fg-muted">{t('notFoundBody')}</p>
        <div className="mt-6 grid gap-3">
          <LinkButton href="/book" variant="primary" block trailingIcon="arrowRight">
            {tNav('book')}
          </LinkButton>
          <InstagramLink variant="plain" />
        </div>
      </div>
    )
  }

  const durationMin = Math.round((new Date(booking.end).getTime() - new Date(booking.start).getTime()) / 60_000)
  const cancelUrl = absoluteUrl(`/${locale}/cancel/${token}`)
  return (
    <>
      <p className="stamp">
        <Icon name="check" />
        {t('stamp')}
        <span lang="en">{t('stampEn')}</span>
      </p>
      <h1 className="title-24 mt-2" id="done-h" tabIndex={-1}>
        {t('heading')}
      </h1>
      <FocusOnMount targetId="done-h" />
      <p className="notice">
        <Icon name="camera" />
        <span>{t('screenshot')}</span>
      </p>

      <section className="done-card" aria-label={t('cardLabel')}>
        <dl className="code">
          <div>
            <dt className="caps">{t('publicCode')}</dt>
            <dd id="public-code">{booking.publicCode}</dd>
          </div>
          <CopyButton
            value={booking.publicCode}
            label={tc('copy')}
            copiedLabel={tc('copiedCheck')}
            liveMessage={tc('copied')}
            ariaLabel={`${t('publicCode')} ${tc('copy')}`}
            selectFallbackId="public-code"
          />
        </dl>
        <div className="rule2" aria-hidden="true" />
        <BookingWhen booking={booking} />
        <dl className="dkv">
          <div>
            <dt>{t('menu')}</dt>
            <dd className="menu-line">
              <span>
                {booking.menuName[lang]}
                {lang === 'ja' ? '　' : ', '}
                {tMenu('duration', { minutes: durationMin })}
              </span>
              <BookingPrice booking={booking} />
            </dd>
          </div>
          <div>
            <dt>{t('stylist')}</dt>
            <dd lang="ja">{shop.stylist.ja}</dd>
          </div>
          <div>
            <dt>{t('shop')}</dt>
            <dd className="shop">
              <b>{shop.name}</b>
              <ExternalButton href={shop.mapUrl} variant="secondary" size="sm" icon="mapPin">
                {t('openMap')}
              </ExternalButton>
              <address lang={lang}>
                {shop.addressLines[lang][0]}
                <br />
                {shop.addressLines[lang][1]}
              </address>
            </dd>
          </div>
        </dl>
      </section>

      <a className="btn btn-primary btn-block mt-4" href={`/api/ics/${token}`} download>
        <Icon name="calendar" />
        <span className="two">
          {t('addToCalendar')}
          <small>{t('addToCalendarSub')}</small>
        </span>
      </a>

      <div className="cancel-link">
        <p className="lbl">{t('cancelLabel', { hours: settings.cancelDeadlineMin / 60 })}</p>
        <div className="row">
          <a className="link" id="cancel-url" href={`/${locale}/cancel/${token}`}>
            {cancelUrl}
          </a>
          <ShareCopyButton
            url={cancelUrl}
            title={t('shareTitle')}
            text={t('shareText', { code: booking.publicCode })}
            label={tc('shareCopy')}
            copiedLabel={tc('copiedCheck')}
            liveMessage={tc('copied')}
            selectFallbackId="cancel-url"
          />
        </div>
        <p className="hint">{t('cancelFromCalendar')}</p>
      </div>

      <div className="done-foot">
        <InstagramLink variant="done" />
        <Link className="btn btn-ghost" href="/policy">
          {t('cancelPolicy')}
        </Link>
      </div>
    </>
  )
}
