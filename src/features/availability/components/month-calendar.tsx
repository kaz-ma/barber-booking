import { useFormatter, useTranslations } from 'next-intl'
import { weekdayOf } from '@/domain/time'
import { Link } from '@/lib/i18n/navigation'
import type { DayDTO, MonthAvailabilityDTO } from '../queries'

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/**
 * Month calendar (S-C-03, FR-C-07). Only ◎ days link (one tap selects the day); other days are
 * inert cells with a reason label. TODO(UI slice): full grid keyboard pattern per
 * 03_screen_specs.md §2.6 and the comps' visual design.
 */
export function MonthCalendar({
  data,
  menuSlug,
  selectedDate,
}: {
  data: MonthAvailabilityDTO
  menuSlug: string
  selectedDate: string
}) {
  const t = useTranslations('availability')
  const format = useFormatter()
  const leading = data.days[0] ? weekdayOf(data.days[0].date) : 0
  const weeks = toWeeks(data.days, leading)
  const monthTitle = format.dateTime(new Date(`${data.month}-15T12:00:00+09:00`), 'monthTitle')

  const reason = (day: DayDTO) => {
    switch (day.status) {
      case 'closed':
        return t(day.closedReason === 'override' ? 'closedOverride' : 'closed')
      case 'full':
        return t('full')
      case 'deadline':
        return t('deadline')
      case 'out_of_range':
        return t('outOfRange')
      default:
        return t('available')
    }
  }

  const renderDay = (day: DayDTO) => {
    const dayNum = Number(day.date.slice(8))
    const selected = day.date === selectedDate
    const label = `${format.dateTime(new Date(`${day.date}T12:00:00+09:00`), 'slotDate')} ${reason(day)}`
    if (day.status === 'available') {
      return (
        <Link
          href={{ pathname: '/book/time', query: { menu: menuSlug, month: data.month, date: day.date } }}
          aria-label={label}
          aria-current={selected ? 'date' : undefined}
          className={`flex min-h-11 flex-col items-center justify-center rounded-sm border ${selected ? 'border-accent bg-accent text-on-accent' : 'border-border bg-bg-card text-status-open'}`}
        >
          <span className="font-num">{dayNum}</span>
          <span aria-hidden="true">◎</span>
        </Link>
      )
    }
    return (
      <span
        className={`flex min-h-11 flex-col items-center justify-center rounded-sm ${selected ? 'border border-fg-subtle' : ''} text-fg-subtle`}
      >
        <span className="font-num">{dayNum}</span>
        <span aria-hidden="true">×</span>
        <span className="sr-only">{label}</span>
      </span>
    )
  }

  return (
    <section aria-label={monthTitle} className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        {data.prevMonth ? (
          <Link
            href={{ pathname: '/book/time', query: { menu: menuSlug, month: data.prevMonth } }}
            aria-label={t('prevMonth')}
            className="min-h-11 min-w-11 p-2"
          >
            ‹
          </Link>
        ) : (
          <span className="min-w-11" />
        )}
        <h2 className="font-bold">{monthTitle}</h2>
        {data.nextMonth ? (
          <Link
            href={{ pathname: '/book/time', query: { menu: menuSlug, month: data.nextMonth } }}
            aria-label={t('nextMonth')}
            className="min-h-11 min-w-11 p-2 text-right"
          >
            ›
          </Link>
        ) : (
          <span className="min-w-11" />
        )}
      </div>
      <table className="w-full table-fixed border-separate border-spacing-1 text-center text-sm">
        <thead>
          <tr>
            {WEEKDAYS.map((w) => (
              <th scope="col" key={w} className="font-normal text-fg-muted">
                {t(`weekdays.${w}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.key}>
              {week.cells.map((cell) => (
                <td key={cell.key}>{cell.day ? renderDay(cell.day) : null}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

type Cell = { key: string; day: DayDTO | null }

/** Sunday-first weeks with blank cells before the 1st and after the last day. */
function toWeeks(days: DayDTO[], leading: number): { key: string; cells: Cell[] }[] {
  const cells: Cell[] = [
    ...Array.from({ length: leading }, (_, i) => ({ key: `lead-${i}`, day: null })),
    ...days.map((day) => ({ key: day.date, day })),
  ]
  while (cells.length % 7 !== 0) cells.push({ key: `trail-${cells.length}`, day: null })
  const weeks: { key: string; cells: Cell[] }[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push({ key: `week-${i / 7}`, cells: cells.slice(i, i + 7) })
  return weeks
}
