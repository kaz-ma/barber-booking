import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { formatsFor } from '@/lib/i18n/formats'
import en from '../../../../messages/en.json'
import ja from '../../../../messages/ja.json'
import { SlotList } from './slot-list'

const push = vi.fn()
vi.mock('@/lib/i18n/navigation', () => ({ useRouter: () => ({ push }) }))

function renderWith(locale: 'ja' | 'en', props: ComponentProps<typeof SlotList>) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ja' ? ja : en}
      timeZone="Asia/Tokyo"
      formats={formatsFor(locale)}
    >
      <SlotList {...props} />
    </NextIntlClientProvider>,
  )
}

const slots = [
  { startsAt: '2026-11-04T18:00:00+09:00', status: 'deadline' as const },
  { startsAt: '2026-11-04T18:30:00+09:00', status: 'full' as const },
  { startsAt: '2026-11-04T19:00:00+09:00', status: 'available' as const },
  { startsAt: '2026-11-04T23:00:00+09:00', status: 'available' as const },
]

describe('SlotList', () => {
  it('links only available slots; × rows are inert text with a reason', () => {
    const { container } = renderWith('ja', { slots, menuSlug: 'cut', durationMin: 60 })
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('19:00–20:00')
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('startsAt=2026-11-04T19%3A00%3A00%2B09%3A00'))
    expect(screen.getByText('予約できません（満席）')).toBeInTheDocument()
    expect(screen.getByText('予約できません（締切）')).toBeInTheDocument()
    // × rows are never focusable
    for (const li of container.querySelectorAll('li.slot.x')) {
      expect(li.querySelector('a, button, [tabindex]')).toBeNull()
    }
  })

  it('applies the 24:00 rule to a slot ending at midnight', () => {
    renderWith('ja', { slots, menuSlug: 'cut', durationMin: 60 })
    expect(screen.getAllByRole('link')[1]).toHaveTextContent('23:00–24:00')
  })

  it('renders JST times in 12-hour format on /en regardless of the runtime time zone', () => {
    renderWith('en', { slots, menuSlug: 'cut', durationMin: 60 })
    expect(screen.getAllByRole('link')[0]).toHaveTextContent('7:00 PM–8:00 PM')
  })

  it('shows the chosen slot as selected and navigates after a short feedback', () => {
    vi.useFakeTimers()
    renderWith('ja', { slots, menuSlug: 'cut', durationMin: 60 })
    const link = screen.getAllByRole('link')[0] as HTMLElement
    fireEvent.click(link)
    expect(link).toHaveAttribute('aria-current', 'true')
    vi.advanceTimersByTime(200)
    expect(push).toHaveBeenCalledWith({
      pathname: '/book/info',
      query: { menu: 'cut', startsAt: '2026-11-04T19:00:00+09:00' },
    })
    vi.useRealTimers()
  })
})
