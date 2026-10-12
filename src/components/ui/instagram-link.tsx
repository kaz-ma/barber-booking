import { useTranslations } from 'next-intl'
import { shop } from '@/config/shop'
import { buttonClass } from './button'
import { cx } from './cx'
import { Icon } from './icon'

/*
 * InstagramLink (DG-001 §5.7, FR-C-16): the only customer contact channel — no phone number or
 * tel: links anywhere. Contact links open the DM thread (ig.me); "see our work" opens the
 * profile. Always a new tab with rel="noopener noreferrer".
 */
type Variant =
  | 'header' // -sm 44px, "Instagram" + verb aria-label
  | 'footer' // 2-line 48px, full width
  | 'done' // -sm 2-line, compact (done page bottom row)
  | 'button' // secondary 48px full width, 2-line with handle
  | 'plain' // secondary 48px full width, single line (404 / error / invalid)
  | 'primary' // primary 56px (past cancellation deadline)
  | 'profile' // secondary 48px full width (top page, profile link)
  | 'inline' // underlined text link

export function InstagramLink({ variant = 'inline', className }: { variant?: Variant; className?: string }) {
  const t = useTranslations('nav')
  const handle = shop.instagram.handle
  const ext = { target: '_blank', rel: 'noopener noreferrer' } as const
  const icon = <Icon name="instagram" />

  switch (variant) {
    case 'header':
      return (
        <a
          href={shop.instagram.dmUrl}
          {...ext}
          aria-label={t('instagramAria', { handle })}
          className={buttonClass({ variant: 'secondary', size: 'sm', className })}
        >
          {icon}
          {t('instagramShort')}
        </a>
      )
    case 'footer':
      return (
        <a
          href={shop.instagram.dmUrl}
          {...ext}
          className={buttonClass({ variant: 'secondary', block: true, className })}
        >
          {icon}
          <span className="two">
            {t('instagramDm')}
            <small className="num">{t('instagramDmSub', { handle })}</small>
          </span>
        </a>
      )
    case 'done':
    case 'button':
      return (
        <a
          href={shop.instagram.dmUrl}
          {...ext}
          className={buttonClass({
            variant: 'secondary',
            size: variant === 'done' ? 'sm' : 'md',
            block: variant === 'button',
            className,
          })}
        >
          {icon}
          <span className="two">
            {t('instagramDm')}
            <small className="num">{t('instagramHandle', { handle })}</small>
          </span>
        </a>
      )
    case 'plain':
    case 'primary':
      return (
        <a
          href={shop.instagram.dmUrl}
          {...ext}
          className={buttonClass({ variant: variant === 'primary' ? 'primary' : 'secondary', block: true, className })}
        >
          {icon}
          {t('instagramDm')}
        </a>
      )
    case 'profile':
      return (
        <a href={shop.instagram.url} {...ext} className={buttonClass({ variant: 'secondary', block: true, className })}>
          {icon}
          {t('instagramProfile')}
        </a>
      )
    default:
      return (
        <a
          href={shop.instagram.dmUrl}
          {...ext}
          className={cx('inline-flex min-h-target-min items-center underline underline-offset-4', className)}
        >
          {t('instagram', { handle })}
        </a>
      )
  }
}
