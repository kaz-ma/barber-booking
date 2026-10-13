import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { shop } from '@/config/shop'
import { Link } from '@/lib/i18n/navigation'
import { LinkButton } from './button'
import { InstagramLink } from './instagram-link'
import { LocaleSwitch } from './locale-switch'

/*
 * Headers (DG-001 §5.3). One emblem per screen, charcoal only.
 *   SiteHeader — top / policies / 404: 64px sticky, emblem 48px + wordmark, EN, 予約する (44px)
 *   FlowHeader — booking steps: 56px sticky, ← back, "ご予約", EN, Instagram (no emblem)
 *   MiniHeader — done / cancel: 56px, emblem 40px + wordmark, EN only (no booking CTA)
 */

function Brand({ height }: { height: 48 | 40 }) {
  const t = useTranslations('nav')
  const width = Math.round((shop.emblem.width / shop.emblem.height) * height)
  return (
    <Link href="/" className="brand" aria-label={t('homeLabel')}>
      <Image src={shop.emblem.src} alt="" width={width} height={height} priority={height === 48} />
      <span className="wm max-[359px]:hidden">
        <b>{t('wordmark')}</b>
        <small lang="ja">{shop.stylist.ja}</small>
      </span>
    </Link>
  )
}

export function SiteHeader({ showBookCta = true }: { showBookCta?: boolean }) {
  const t = useTranslations('nav')
  return (
    <header className="site-head paper">
      <div className="in">
        <Brand height={48} />
        <LocaleSwitch />
        {showBookCta ? (
          <LinkButton href="/#book" variant="primary" size="sm">
            {t('book')}
          </LinkButton>
        ) : null}
      </div>
    </header>
  )
}

export function FlowHeader({ back }: { back: ReactNode }) {
  const t = useTranslations('nav')
  return (
    <header className="flow-head paper">
      <div className="in">
        {back}
        <p className="title">{t('flowTitle')}</p>
        <LocaleSwitch />
        <InstagramLink variant="header" />
      </div>
    </header>
  )
}

export function MiniHeader() {
  return (
    <header className="mini-head paper">
      <div className="in">
        <Brand height={40} />
        <LocaleSwitch />
      </div>
    </header>
  )
}
