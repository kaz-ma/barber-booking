import { useLocale, useTranslations } from 'next-intl'
import type { MenuCatalogItem } from '../catalog'
import { Yen } from './price'

/**
 * MenuCard variant="info" (S-C-01, DG-001 §5.2): an <article>, not a link or button — no focus,
 * no hover. The way into booking is the single "予約する" CTA after the list (D-10).
 * Inactive menus (prices pending, OI-01) still show, with "¥—".
 */
export function MenuInfoCard({ menu }: { menu: MenuCatalogItem }) {
  const locale = useLocale() as 'ja' | 'en'
  const t = useTranslations('menu')
  const tc = useTranslations('common')
  const other = locale === 'ja' ? 'en' : 'ja'
  const price = menu.isActive ? menu.priceJpy : 0
  const description = menu.description[locale]
  return (
    <article className="menu-card card">
      <h3>
        {menu.name[locale]}
        <span className="caps" lang={other}>
          {menu.name[other]}
        </span>
      </h3>
      <p className="price">
        <Yen amount={price} unsetSr={tc('priceUnsetSr')} />
      </p>
      {description ? <p className="desc">{description}</p> : null}
      <p className="dur">{t('duration', { minutes: menu.durationMin })}</p>
    </article>
  )
}
