'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Yen } from './price'
import type { BookingMenu } from './types'

export type MenuPickerItem = BookingMenu & { description: { ja: string | null; en: string | null } }

/**
 * Step ① on the top page: one compact row per menu (native radio inside a label — usable before
 * hydration). Picking a row is the completion of the step: the section collapses it to a
 * one-line summary and opens the date step (no separate "next" button).
 */
export function MenuPicker({
  menus,
  selected,
  onSelect,
  labelledBy,
}: {
  menus: MenuPickerItem[]
  selected: string
  onSelect: (slug: string) => void
  labelledBy: string
}) {
  const t = useTranslations('menu')
  const tc = useTranslations('common')
  const locale = useLocale() as 'ja' | 'en'
  const other = locale === 'ja' ? 'en' : 'ja'
  return (
    <fieldset className="mrows" aria-labelledby={labelledBy}>
      {menus.map((m) => (
        <label key={m.slug} className="mrow">
          <input
            type="radio"
            name="menu"
            value={m.slug}
            checked={selected === m.slug}
            onChange={() => onSelect(m.slug)}
            aria-describedby={`m-${m.slug}-d`}
          />
          <span className="rdot" aria-hidden="true" />
          <span className="mrow-name">
            {m.name[locale]}
            <span className="caps" lang={other}>
              {m.name[other]}
            </span>
          </span>
          <span className="mrow-meta" id={`m-${m.slug}-d`}>
            <b className="num">
              <Yen amount={m.priceJpy} unsetSr={tc('priceUnsetSr')} />
            </b>
            {m.priceStudentJpy !== null && m.priceJpy > 0 ? (
              <span className="stu">
                {t('student')} <Yen amount={m.priceStudentJpy} unsetSr={tc('priceUnsetSr')} />
              </span>
            ) : null}
            <span className="dur">{t('duration', { minutes: m.durationMin })}</span>
          </span>
          {m.description[locale] ? <span className="mrow-desc">{m.description[locale]}</span> : null}
        </label>
      ))}
    </fieldset>
  )
}
