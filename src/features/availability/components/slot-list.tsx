'use client'

import { useLocale, useTranslations } from 'next-intl'
import { type MouseEvent, useState } from 'react'
import { cx } from '@/components/ui/cx'
import { Icon } from '@/components/ui/icon'
import { formatTimeSpan } from '@/lib/i18n/display'
import { useRouter } from '@/lib/i18n/navigation'
import type { SlotDTO } from '../queries'

export type SlotListProps = {
  slots: SlotDTO[]
  menuSlug: string
  durationMin: number
  /** startsAt of the slot chosen earlier (returning from a later step): highlighted. */
  selectedStartsAt?: string
  /** Extra query kept on the next-step link (e.g. return=confirm). */
  keep?: Record<string, string>
}

export function slotHref(menuSlug: string, startsAt: string, keep: Record<string, string> = {}) {
  return { pathname: '/book/info' as const, query: { ...keep, menu: menuSlug, startsAt } }
}

/**
 * Time slots for the selected day (S-C-03, DG-001 §5.6). Every candidate is a row: ◎ rows are
 * 56px links (tap → 150 ms "selected" feedback → next step); × rows are inert 48px <li> text with
 * the reason — no button, link or tabindex — so status never relies on colour (NFR-EN-06).
 */
export function SlotList({ slots, menuSlug, durationMin, selectedStartsAt, keep }: SlotListProps) {
  const t = useTranslations('availability')
  const locale = useLocale()
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  function choose(e: MouseEvent<HTMLAnchorElement>, startsAt: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    setPending(startsAt)
    setTimeout(() => router.push(slotHref(menuSlug, startsAt, keep)), 150)
  }

  return (
    <ul className="slots" aria-labelledby="slots-h">
      {slots.map((slot) => {
        const start = new Date(slot.startsAt)
        const span = formatTimeSpan(start, new Date(start.getTime() + durationMin * 60_000), locale)
        const [from, to] = span.split('–')
        const time = (
          <span className="t">
            {from}
            <span>–</span>
            {to}
            {locale === 'en' ? <small>JST</small> : null}
          </span>
        )
        if (slot.status !== 'available') {
          const reason = t(slot.status === 'full' ? 'full' : 'deadline')
          return (
            <li key={slot.startsAt} className="slot x">
              <span className="mk" aria-hidden="true">
                ×
              </span>
              {time}
              <span className="end">
                <span className="sr-only">{t('slotUnavailableSr', { reason })}</span>
                <span aria-hidden="true">{reason}</span>
              </span>
            </li>
          )
        }
        const selected = (pending ?? selectedStartsAt) === slot.startsAt
        return (
          <li key={slot.startsAt}>
            <a
              href={`/${locale}/book/info?${new URLSearchParams({ ...keep, menu: menuSlug, startsAt: slot.startsAt })}`}
              onClick={(e) => choose(e, slot.startsAt)}
              className={cx('slot', selected ? 'sel' : 'open')}
              aria-current={selected ? 'true' : undefined}
              aria-label={t(selected ? 'slotSelectedAria' : 'slotAria', { time: span })}
            >
              <span className="mk">◎</span>
              {time}
              <span className="end">
                {selected ? (
                  <>
                    <Icon name="check" />
                    {t('selected')}
                  </>
                ) : (
                  <Icon name="chevronRight" />
                )}
              </span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
