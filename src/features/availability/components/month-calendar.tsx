'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { BarberPole } from '@/components/ui/barber-pole'
import { buttonClass } from '@/components/ui/button'
import { cx } from '@/components/ui/cx'
import { Icon } from '@/components/ui/icon'
import { addDays, weekdayOf } from '@/domain/time'
import { formatDateAria, formatMonthTitle } from '@/lib/i18n/display'
import type { DayDTO } from '../queries'

/** Monday-first header keys (DG-001 §5.5). */
const DOW = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export type MonthCalendarProps = {
  month: string
  days: DayDTO[]
  prevMonth?: string
  nextMonth?: string
  /** JST today, 'YYYY-MM-DD'. */
  today: string
  /** Selected date in this month (initially today, OI-24), or null after moving months. */
  selectedDate: string | null
  /** A ◎ day was chosen (instant: the month's slots are already loaded). */
  onSelectDate: (date: string) => void
  /** Previous / next month requested. */
  onMonth: (month: string) => void
}

type KeyAction = 'prev' | 'next' | 'up' | 'down' | 'home' | 'end'
const KEYS: Record<string, KeyAction> = {
  ArrowLeft: 'prev',
  ArrowRight: 'next',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Home: 'home',
  End: 'end',
}

/**
 * MonthCalendar (S-C-03, FR-C-07, 03_screen_specs §2.6): `<table role="grid">`, Monday first.
 * Only ◎ days are buttons (one tab stop, roving tabindex); × / past / out-of-range days are plain
 * cells — never focusable — whose text is still readable with a virtual cursor. Selecting a day
 * or a month is a callback: the booking section already holds the month's slots (ADR-0010).
 * Keys: ←/→ previous/next ◎ day, ↑/↓ ±7 days (continuing by weeks until a ◎ day), Home/End
 * first/last ◎ day, PageUp/PageDown previous/next month, Enter/Space select.
 */
export function MonthCalendar(props: MonthCalendarProps) {
  const { month, days, prevMonth, nextMonth, today, selectedDate, onSelectDate, onMonth } = props
  const t = useTranslations('availability')
  const locale = useLocale()
  const tableRef = useRef<HTMLTableElement>(null)
  const pendingFocus = useRef(false)

  const available = days.filter((d) => d.status === 'available').map((d) => d.date)
  const initialStop = selectedDate && available.includes(selectedDate) ? selectedDate : (available[0] ?? null)
  const [stop, setStop] = useState<{ month: string; date: string | null }>({ month, date: initialStop })
  // Reset the tab stop when the month (or selection) changes under us.
  const tabStop = stop.month === month && stop.date && available.includes(stop.date) ? stop.date : initialStop

  const monthTitle = formatMonthTitle(month, locale)

  function focusDate(date: string) {
    setStop({ month, date })
    tableRef.current?.querySelector<HTMLElement>(`[data-date="${date}"]`)?.focus()
  }

  // After PageUp/PageDown the new month renders in place: move focus into the new grid.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the month changes
  useEffect(() => {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    const target = tableRef.current?.querySelector<HTMLElement>('button[tabindex="0"]')
    target?.focus()
  }, [month])

  // Keydown is handled on the grid (composite widget pattern), attached imperatively.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement
    const current = el.dataset.date
    if (!current) return
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      el.click()
      return
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      const m = e.key === 'PageUp' ? prevMonth : nextMonth
      e.preventDefault()
      if (!m) return
      pendingFocus.current = true
      onMonth(m)
      return
    }
    const action = KEYS[e.key]
    if (!action) return
    e.preventDefault()
    const idx = available.indexOf(current)
    let target: string | undefined
    switch (action) {
      case 'prev':
        target = available[idx - 1]
        break
      case 'next':
        target = available[idx + 1]
        break
      case 'home':
        target = available[0]
        break
      case 'end':
        target = available[available.length - 1]
        break
      default: {
        const step = action === 'down' ? 7 : -7
        for (let d = addDays(current, step); d.startsWith(month); d = addDays(d, step)) {
          if (available.includes(d)) {
            target = d
            break
          }
        }
      }
    }
    if (target) focusDate(target)
  })

  useEffect(() => {
    const table = tableRef.current
    if (!table) return
    const listener = (e: KeyboardEvent) => onKeyDown(e)
    table.addEventListener('keydown', listener)
    return () => table.removeEventListener('keydown', listener)
  }, [])

  const weeks = toWeeks(days)
  const reasonOf = (day: DayDTO): string => {
    switch (day.status) {
      case 'full':
        return t('full')
      case 'deadline':
        return t('deadline')
      case 'closed':
        return t(day.closedReason === 'override' ? 'closedOverride' : 'closed')
      default:
        return ''
    }
  }

  function renderDay(day: DayDTO) {
    const n = Number(day.date.slice(8))
    const isToday = day.date === today
    const isSelected = day.date === selectedDate
    const dateAria = formatDateAria(day.date, locale)
    if (day.status === 'available') {
      const label = [dateAria, isToday ? t('today') : '', t('open'), isSelected ? t('selected') : '']
        .filter(Boolean)
        .join(' ')
      return (
        // biome-ignore lint/a11y: explicit gridcell so aria-selected is valid; focus lives on the inner link (roving tabindex)
        <td key={day.date} role="gridcell" aria-selected={isSelected}>
          <button
            type="button"
            onClick={() => onSelectDate(day.date)}
            data-date={day.date}
            tabIndex={day.date === tabStop ? 0 : -1}
            onFocus={() => setStop({ month, date: day.date })}
            aria-label={label}
            aria-current={isToday ? 'date' : undefined}
            className={cx('cd open', isToday && 'today', isSelected && 'sel')}
          >
            <b aria-hidden="true">{n}</b>
            <span className="mk" aria-hidden="true">
              ◎
            </span>
          </button>
        </td>
      )
    }
    if (day.status === 'out_of_range') {
      const label = [dateAria, isToday ? t('today') : '', day.date < today ? t('past') : t('outOfRange')]
        .filter(Boolean)
        .join(' ')
      return (
        <td key={day.date}>
          <span className={cx('cd off', isToday && 'today')}>
            <b aria-hidden="true">{n}</b>
            <span className="sr-only">{label}</span>
          </span>
        </td>
      )
    }
    const reason = reasonOf(day)
    const label = [dateAria, isToday ? t('today') : '', t('notOpen'), reason].filter(Boolean).join(' ')
    return (
      <td key={day.date}>
        <span className={cx('cd x', isToday && 'today')} aria-current={isToday ? 'date' : undefined}>
          <b aria-hidden="true">{day.status === 'full' ? <s>{n}</s> : n}</b>
          <span className="mk" aria-hidden="true">
            × {reason}
          </span>
          <span className="sr-only">{label}</span>
        </span>
      </td>
    )
  }

  return (
    <div>
      <div className="month">
        {prevMonth ? (
          <button
            type="button"
            onClick={() => onMonth(prevMonth)}
            className={buttonClass({ variant: 'secondary', className: 'btn-icon' })}
            aria-label={t('monthTo', { label: t('prevMonth'), month: formatMonthTitle(prevMonth, locale) })}
          >
            <Icon name="chevronLeft" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            className={buttonClass({ variant: 'secondary', className: 'btn-icon' })}
            aria-label={t('monthOff', { label: t('prevMonth') })}
          >
            <Icon name="chevronLeft" />
          </button>
        )}
        <h2 id="month-h" aria-live="polite">
          {monthTitle}
        </h2>
        {nextMonth ? (
          <button
            type="button"
            onClick={() => onMonth(nextMonth)}
            className={buttonClass({ variant: 'secondary', className: 'btn-icon' })}
            aria-label={t('monthTo', { label: t('nextMonth'), month: formatMonthTitle(nextMonth, locale) })}
          >
            <Icon name="chevronRight" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            className={buttonClass({ variant: 'secondary', className: 'btn-icon' })}
            aria-label={t('monthOff', { label: t('nextMonth') })}
          >
            <Icon name="chevronRight" />
          </button>
        )}
      </div>
      {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: ARIA grid pattern (03_screen_specs §2.6); td cells become gridcells */}
      <table ref={tableRef} className="cal" role="grid" aria-labelledby="month-h">
        <thead>
          <tr>
            {DOW.map((w) => (
              <th key={w} scope="col" abbr={t(`weekdaysLong.${w}`)}>
                {t(`weekdays.${w}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.key}>{week.cells.map((cell) => (cell.day ? renderDay(cell.day) : <td key={cell.key} />))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type Cell = { key: string; day: DayDTO | null }

/** Monday-first weeks with blank cells before the 1st and after the last day (not rendered). */
export function toWeeks(days: DayDTO[]): { key: string; cells: Cell[] }[] {
  const first = days[0]
  const leading = first ? (weekdayOf(first.date) + 6) % 7 : 0
  const cells: Cell[] = [
    ...Array.from({ length: leading }, (_, i) => ({ key: `lead-${i}`, day: null })),
    ...days.map((day) => ({ key: day.date, day })),
  ]
  while (cells.length % 7 !== 0) cells.push({ key: `trail-${cells.length}`, day: null })
  const weeks: { key: string; cells: Cell[] }[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push({ key: `week-${i / 7}`, cells: cells.slice(i, i + 7) })
  return weeks
}

/** Fixed-height skeleton (weekday row + 6 rows × 7), no blinking (CLS 0, DG-001 §9.1 (c)). */
export function MonthCalendarSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      <BarberPole className="mb-3" />
      <div className="month">
        <span />
        <span className="mx-auto block h-7 w-32 rounded-sm bg-bg-sunken" />
        <span />
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 42 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cells
          <span key={i} className="cal-skel" />
        ))}
      </div>
    </div>
  )
}
