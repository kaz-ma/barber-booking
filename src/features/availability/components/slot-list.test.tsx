import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { formatsFor } from '@/lib/i18n/formats'
import en from '../../../../messages/en.json'
import ja from '../../../../messages/ja.json'
import { SlotList } from './slot-list'

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: { pathname: string; query: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={`${href.pathname}?${new URLSearchParams(href.query)}`} {...rest}>
      {children}
    </a>
  ),
}))

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
]

describe('SlotList', () => {
  it('links only available slots and labels the others with a text reason', () => {
    renderWith('ja', { slots, menuSlug: 'cut' })
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent('19:00')
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('startsAt=2026-11-04T19%3A00%3A00%2B09%3A00'))
    expect(screen.getByText('× 満席')).toBeInTheDocument()
    expect(screen.getByText('× 締切')).toBeInTheDocument()
  })

  it('renders JST times in 12-hour format on /en regardless of the runtime time zone', () => {
    renderWith('en', { slots, menuSlug: 'cut' })
    expect(screen.getByRole('link')).toHaveTextContent('7:00 PM')
  })

  it('shows the empty message when there are no slots', () => {
    renderWith('ja', { slots: [], menuSlug: 'cut' })
    expect(screen.getByText(ja.availability.noSlots)).toBeInTheDocument()
  })
})
