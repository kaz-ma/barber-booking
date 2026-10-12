import { useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import { Icon } from './icon'
import { InstagramLink } from './instagram-link'

/**
 * Footer (DG-001 §5.3): sunken surface with a double rule, Instagram DM (2 lines, 48px),
 * three policy rows (44px) and ©. `showInstagram={false}` on 404 / error pages, where the body
 * already has the single Instagram action (HE-01).
 */
export function Footer({ showInstagram = true }: { showInstagram?: boolean }) {
  const t = useTranslations('nav')
  const links = [
    { href: '/privacy', label: t('privacy') },
    { href: '/policy', label: t('policy') },
    { href: '/tokusho', label: t('tokusho') },
  ] as const
  return (
    <footer className="site-foot">
      <div className="wrap">
        {showInstagram ? <InstagramLink variant="footer" /> : null}
        <nav aria-label={t('policies')}>
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
              <Icon name="chevronRight" />
            </Link>
          ))}
        </nav>
        <small className="copy">{t('copyright')}</small>
      </div>
    </footer>
  )
}
