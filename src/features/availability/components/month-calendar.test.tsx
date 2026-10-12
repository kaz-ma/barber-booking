import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { formatsFor } from '@/lib/i18n/formats'
import ja from '../../../../messages/ja.json'
import type { DayDTO } from '../queries'
import { MonthCalendar } from './month-calendar'

const push = vi.fn()
vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push }),
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: { pathname: string; query: Record<string, string> }
    children: ReactNode
    scroll?: boolean
  }) => {
    const { scroll, ...attrs } = rest as { scroll?: boolean } & Record<string, unknown>
    void scroll
    return (
      <a href={`${href.pathname}?${new URLSearchParams(href.query)}`} {...attrs}>
        {children}
      </a>
    )
  },
}))

// November 2026 starts on a Sunday: Monday-first grid has 6 blank leading cells.
const days: DayDTO[] = Array.from({ length: 30 }, (_, i) => {
  const date = `2026-11-${String(i + 1).padStart(2, '0')}`
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  if (i < 2) return { date, status: 'out_of_range' }
  if (dow === 1) return { date, status: 'closed', closedReason: 'regular' }
  if (i === 3) return { date, status: 'full' }
  return { date, status: 'available' }
})

function renderCalendar(selectedDate: string | null) {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja} timeZone="Asia/Tokyo" formats={formatsFor('ja')}>
      <MonthCalendar
        month="2026-11"
        days={days}
        today="2026-11-03"
        selectedDate={selectedDate}
        menuSlug="cut"
        nextMonth="2026-12"
      />
    </NextIntlClientProvider>,
  )
}

describe('MonthCalendar', () => {
  it('is a Monday-first grid; only ◎ days are links and only × reasons are text', () => {
    const { container } = renderCalendar('2026-11-03')
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('月')
    expect(container.querySelectorAll('tbody tr')[0]?.querySelectorAll('td')).toHaveLength(7)
    expect(screen.getAllByText('× 定休').length).toBeGreaterThan(0)
    for (const cell of container.querySelectorAll('.cd.x, .cd.off')) expect(cell.closest('a')).toBeNull()
    expect(screen.getByRole('link', { name: /11月3日 火曜日 今日 予約できます 選択中/ })).toHaveAttribute(
      'aria-current',
      'date',
    )
  })

  it('has a single tab stop and moves between ◎ days with the arrow keys', () => {
    const { container } = renderCalendar('2026-11-03')
    const stops = container.querySelectorAll('a[tabindex="0"]')
    expect(stops).toHaveLength(1)
    const start = stops[0] as HTMLElement
    expect(start.dataset.date).toBe('2026-11-03')
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    // 11/4 is full, so the next ◎ day is 11/5
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-11-05')
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-11-12')
    fireEvent.keyDown(document.activeElement as Element, { key: 'End' })
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-11-29')
    fireEvent.keyDown(document.activeElement as Element, { key: 'PageDown' })
    expect(push).toHaveBeenCalledWith(
      { pathname: '/book/time', query: { menu: 'cut', month: '2026-12' } },
      { scroll: false },
    )
  })

  it('disables the previous-month arrow outside the booking window', () => {
    renderCalendar(null)
    expect(screen.getByRole('button', { name: '前の月（予約できる期間外）' })).toBeDisabled()
  })
})
