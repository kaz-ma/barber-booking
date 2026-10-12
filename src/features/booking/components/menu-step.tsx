'use client'

import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { LinkButton } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Toast } from '@/components/ui/toast'
import { loadDraft, updateDraft, useDraft } from '../draft'
import { Yen, yenText } from './price'
import type { BookingMenu } from './types'

export type MenuStepItem = BookingMenu & { description: { ja: string | null; en: string | null } }

/**
 * S-C-02 MenuStep: RadioCards (native radios inside labels — usable before hydration) and the
 * sticky "空き時間を見て予約する" CTA, shown only after a menu is chosen (OI-25). The choice lives
 * in the URL (?menu=) and in the draft, so "back" from the time step keeps it.
 */
export function MenuStep({ menus }: { menus: MenuStepItem[] }) {
  const params = useSearchParams()
  const fromUrl = params.get('menu') ?? ''
  const expired = params.get('expired') === '1'
  const t = useTranslations('menu')
  const tSteps = useTranslations('booking.steps')
  const tc = useTranslations('common')
  const locale = useLocale() as 'ja' | 'en'
  const other = locale === 'ja' ? 'en' : 'ja'
  const valid = (slug: string) => menus.some((m) => m.slug === slug)
  const draft = useDraft()
  const [picked, setPicked] = useState<string | null>(null)
  // ?menu= wins; otherwise restore the draft's menu (e.g. browser back from the time step).
  const selected = picked ?? (valid(fromUrl) ? fromUrl : draft?.menuSlug && valid(draft.menuSlug) ? draft.menuSlug : '')

  function choose(slug: string) {
    setPicked(slug)
    const d = loadDraft()
    // A different menu changes the duration: the chosen time must be picked again.
    updateDraft({ menuSlug: slug, ...(d && d.menuSlug !== slug ? { startsAt: '' } : {}) })
    const url = new URL(window.location.href)
    url.searchParams.set('menu', slug)
    url.searchParams.delete('expired')
    window.history.replaceState(window.history.state, '', url)
  }

  const menu = menus.find((m) => m.slug === selected)

  return (
    <>
      {expired ? <Toast message={t('expired')} /> : null}
      <fieldset className="rcards" aria-labelledby="menu-step-h">
        {menus.map((m) => {
          const studentPrice = m.priceStudentJpy
          return (
            <label key={m.slug} className="rcard">
              <input
                type="radio"
                name="menu"
                value={m.slug}
                checked={selected === m.slug}
                onChange={() => choose(m.slug)}
                aria-labelledby={`m-${m.slug}`}
                aria-describedby={`m-${m.slug}-d`}
              />
              <span className="rdot" aria-hidden="true" />
              <span>
                <span className="mname" id={`m-${m.slug}`}>
                  {m.name[locale]}
                  <span className="caps" lang={other}>
                    {m.name[other]}
                  </span>
                </span>
                <span id={`m-${m.slug}-d`}>
                  <span className="prices">
                    <span className="g">
                      <i>{t('general')}</i>
                      <b>
                        <Yen amount={m.priceJpy} unsetSr={tc('priceUnsetSr')} />
                      </b>
                    </span>
                    {studentPrice !== null || m.priceJpy === 0 ? (
                      <span className="s">
                        <i>{t('student')}</i>
                        <b>
                          <Yen amount={m.priceJpy === 0 ? 0 : studentPrice} unsetSr={tc('priceUnsetSr')} />
                        </b>
                      </span>
                    ) : null}
                    <span className="dur">{t('duration', { minutes: m.durationMin })}</span>
                  </span>
                  {m.description[locale] ? <span className="desc">{m.description[locale]}</span> : null}
                </span>
              </span>
              <span className="badge" aria-hidden="true">
                <Icon name="check" />
                {t('selected')}
              </span>
            </label>
          )
        })}
      </fieldset>

      <p className="next-step">
        <span className="step-dot" aria-hidden="true">
          2
        </span>
        <span>
          <b>{t('nextStep')}</b> {t('nextStepNote')}
        </span>
      </p>

      {menu ? (
        <div className="sticky-cta paper">
          <div className="in">
            <p className="sum" aria-live="polite">
              <span>
                <b>{menu.name[locale]}</b>
              </span>
              <span>／ {t('duration', { minutes: menu.durationMin })}</span>
              <span>
                ／ {t('summaryGeneral', { price: yenText(menu.priceJpy) })}
                {menu.priceStudentJpy !== null || menu.priceJpy === 0
                  ? t('summaryStudent', { price: yenText(menu.priceJpy === 0 ? 0 : menu.priceStudentJpy) })
                  : ''}
              </span>
            </p>
            <LinkButton
              href={{ pathname: '/book/time', query: { menu: menu.slug } }}
              variant="primary"
              block
              trailingIcon="arrowRight"
            >
              {tSteps('toTime')}
            </LinkButton>
          </div>
        </div>
      ) : null}
    </>
  )
}
