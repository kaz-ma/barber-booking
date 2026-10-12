'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { Link } from '@/lib/i18n/navigation'
import { type CancelBookingState, cancelBooking } from '../actions'

/**
 * S-C-06 action area. GET never cancels (link previews must not cancel, T-10); the POST
 * happens only after an explicit second confirmation. TODO(UI slice): <dialog> ConfirmDialog.
 */
export function CancelPanel({ token, locale }: { token: string; locale: 'ja' | 'en' }) {
  const t = useTranslations()
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, pending] = useActionState<CancelBookingState, FormData>(cancelBooking, null)

  if (state?.status === 'ok') {
    return (
      <div role="status" className="space-y-3">
        <p className="font-bold">{t('cancel.done')}</p>
        <Link href="/book" className="underline">
          {t('cancel.bookAgain')}
        </Link>
      </div>
    )
  }
  if (state?.status === 'past_deadline') {
    return (
      <div role="alert" className="space-y-2">
        <p>{t('contact.pastDeadline')}</p>
        <InstagramLink label={t('nav.instagram', { handle: shop.instagram.handle })} />
      </div>
    )
  }
  if (state) {
    return <p role="alert">{t(state.status === 'not_found' ? 'cancel.notFound' : 'booking.errors.error')}</p>
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-14 w-full rounded-sm border-2 border-fg font-bold"
      >
        {t('cancel.button')}
      </button>
    )
  }
  return (
    <form action={formAction} className="space-y-3 rounded-sm border border-border p-4">
      <p>{t('cancel.confirmQuestion')}</p>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="locale" value={locale} />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-11 flex-1 rounded-sm border border-border"
        >
          {t('cancel.back')}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 flex-1 rounded-sm bg-fg font-bold text-bg disabled:opacity-60"
        >
          {t('cancel.confirmButton')}
        </button>
      </div>
    </form>
  )
}
