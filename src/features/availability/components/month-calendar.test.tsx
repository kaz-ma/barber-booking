import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { formatsFor } from '@/lib/i18n/formats'
import ja from '../../../../messages/ja.json'
import type { DayDTO } from '../queries'
import { MonthCalendar } from './month-calendar'

// button.tsx imports the locale-aware Link; the calendar itself never navigates.
vi.mock('@/lib/i18n/navigation', () => ({ Link: () => null, useRouter: () => ({ push: vi.fn() }) }))

const onSelectDate = vi.fn()
const onMonth = vi.fn()

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
        onSelectDate={onSelectDate}
        onMonth={onMonth}
        nextMonth="2026-12"
      />
    </NextIntlClientProvider>,
  )
}

describe('MonthCalendar', () => {
  it('is a Monday-first grid; only ◎ days are buttons and only × reasons are text', () => {
    const { container } = renderCalendar('2026-11-03')
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('月')
    expect(container.querySelectorAll('tbody tr')[0]?.querySelectorAll('td')).toHaveLength(7)
    expect(screen.getAllByText('× 定休').length).toBeGreaterThan(0)
    for (const cell of container.querySelectorAll('.cd.x, .cd.off')) expect(cell.closest('button')).toBeNull()
    expect(screen.getByRole('button', { name: /11月3日 火曜日 今日 予約できます 選択中/ })).toHaveAttribute(
      'aria-current',
      'date',
    )
  })

  it('has a single tab stop and moves between ◎ days with the arrow keys', () => {
    const { container } = renderCalendar('2026-11-03')
    const stops = container.querySelectorAll('button[data-date][tabindex="0"]')
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
    expect(onMonth).toHaveBeenCalledWith('2026-12')
  })

  it('selecting a ◎ day calls back with the date (no navigation)', () => {
    renderCalendar('2026-11-03')
    fireEvent.click(screen.getByRole('button', { name: /11月5日/ }))
    expect(onSelectDate).toHaveBeenCalledWith('2026-11-05')
  })

  it('disables the previous-month arrow outside the booking window', () => {
    renderCalendar(null)
    expect(screen.getByRole('button', { name: '前の月（予約できる期間外）' })).toBeDisabled()
  })
})
