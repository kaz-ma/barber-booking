import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import type { SlotDTO } from '../queries'

/**
 * Time slots for the selected day (S-C-03). Only ◎ slots are links; × rows stay visible but
 * inert with a text reason, so status is never conveyed by colour alone (NFR-EN-06).
 */
export function SlotList({ slots, menuSlug }: { slots: SlotDTO[]; menuSlug: string }) {
  const t = useTranslations('availability')
  const format = useFormatter()
  if (slots.length === 0) return <p className="text-fg-muted">{t('noSlots')}</p>
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {slots.map((slot) => {
        const time = format.dateTime(new Date(slot.startsAt), 'slotTime')
        return (
          <li key={slot.startsAt}>
            {slot.status === 'available' ? (
              <Link
                href={{ pathname: '/book/info', query: { menu: menuSlug, startsAt: slot.startsAt } }}
                className="flex min-h-11 items-center justify-between rounded-sm border border-border bg-bg-card px-3 font-num text-status-open"
              >
                <span>{time}</span>
                <span aria-hidden="true">{t('available')}</span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="flex min-h-11 items-center justify-between rounded-sm bg-bg-sunken px-3 font-num text-fg-subtle"
              >
                <span>{time}</span>
                <span>× {t(slot.status === 'full' ? 'full' : 'deadline')}</span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
