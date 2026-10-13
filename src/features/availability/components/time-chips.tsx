'use client'

import { useLocale, useTranslations } from 'next-intl'
import { cx } from '@/components/ui/cx'
import { formatTimeSpan } from '@/lib/i18n/display'

export type TimeChipsProps = {
  /** Bookable start times of the selected day (JST ISO strings). */
  slots: string[]
  durationMin: number
  selected?: string
  onSelect: (startsAt: string) => void
  labelledBy: string
}

/**
 * Bookable start times of one day as a compact grid of toggle buttons (S-C-03, DG-001 §5.6).
 * Only open times are listed: a full or closed time has nothing to press, so it is left out
 * rather than shown greyed. Choosing a time is the completion of the step (no extra button).
 */
export function TimeChips({ slots, durationMin, selected, onSelect, labelledBy }: TimeChipsProps) {
  const t = useTranslations('availability')
  const locale = useLocale()
  return (
    <ul className="tchips" aria-labelledby={labelledBy}>
      {slots.map((startsAt) => {
        const start = new Date(startsAt)
        const span = formatTimeSpan(start, new Date(start.getTime() + durationMin * 60_000), locale)
        const from = span.split('–')[0]
        const isSel = selected === startsAt
        return (
          <li key={startsAt}>
            <button
              type="button"
              className={cx('tchip', isSel && 'sel')}
              aria-pressed={isSel}
              aria-label={t(isSel ? 'slotSelectedAria' : 'slotAria', { time: span })}
              onClick={() => onSelect(startsAt)}
            >
              {from}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
