'use client'

import type { Route } from 'next'
import { useRouter as useNextRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useActionState, useEffect, useState } from 'react'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { type CreateBookingState, createBooking } from '../actions'
import { clearDraft, loadDraft, useDraft, useSubmissionNonce } from '../draft'
import { asErrorKey, resultMessageKey } from '../messages'
import { SelectionSummary } from './selection-summary'
import { TurnstileWidget } from './turnstile-widget'
import type { BookingMenu } from './types'

/** Placeholder token when no site key is configured (local dev; the server skips siteverify). */
const DEV_TURNSTILE_TOKEN = 'turnstile-not-configured'

/** S-C-04: review + consent + Turnstile + honeypot -> createBooking via useActionState. */
export function ConfirmForm({ menus, turnstileSiteKey }: { menus: BookingMenu[]; turnstileSiteKey?: string }) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const nextRouter = useNextRouter()
  const draft = useDraft()
  const nonce = useSubmissionNonce()
  const [turnstileToken, setTurnstileToken] = useState(turnstileSiteKey ? '' : DEV_TURNSTILE_TOKEN)
  const [state, formAction, pending] = useActionState<CreateBookingState, FormData>(createBooking, null)

  useEffect(() => {
    if (state?.status === 'ok') {
      clearDraft()
      // doneUrl is already locale-prefixed: use the plain Next router.
      nextRouter.replace(state.data.doneUrl as Route)
    } else if (state?.status === 'conflict') {
      // The slot was just taken: send the customer back to pick another time.
      const d = loadDraft()
      if (d) router.push({ pathname: '/book/time', query: { menu: d.menuSlug, date: d.startsAt.slice(0, 10) } })
    }
  }, [state, nextRouter, router])

  // After success the draft is cleared while navigation is in flight: keep a neutral state.
  if (state?.status === 'ok') return <p role="status">{t('confirm.submitting')}</p>
  if (draft === undefined) return null
  if (draft === null) {
    return (
      <p>
        {t('confirm.missingDraft')}{' '}
        <Link href="/book" className="underline">
          {t('booking.steps.menu')}
        </Link>
      </p>
    )
  }

  const menu = menus.find((m) => m.slug === draft.menuSlug)
  const messageKey = resultMessageKey(state)
  const fieldErrors = state?.status === 'invalid' ? state.fieldErrors : {}

  return (
    <form action={formAction} className="space-y-4">
      <SelectionSummary menu={menu} startsAt={draft.startsAt} occupation={draft.occupation} />
      {Object.entries(draft).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="submissionNonce" value={nonce} />
      <input type="hidden" name="turnstileToken" value={turnstileToken} />
      {/* Honeypot (FR-S-05): hidden from people and assistive tech, bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          {t('confirm.honeypot')}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="consent" value="on" required className="mt-1.5 size-5" />
        <span>{t('confirm.consent')}</span>
      </label>
      {turnstileSiteKey ? (
        <TurnstileWidget siteKey={turnstileSiteKey} locale={locale} onToken={setTurnstileToken} />
      ) : (
        <p className="text-sm text-fg-muted">{t('confirm.turnstileDev')}</p>
      )}
      {messageKey ? (
        <div role="alert" className="rounded-sm border border-accent p-3">
          <p>{t(`booking.errors.${messageKey}`)}</p>
          {Object.entries(fieldErrors).map(([field, keys]) => (
            <p key={field} className="text-sm">
              {t(`booking.errors.${asErrorKey(keys[0])}`)}
            </p>
          ))}
          {messageKey === 'duplicate' || messageKey === 'restricted' || messageKey === 'error' ? (
            <InstagramLink label={t('nav.instagram', { handle: shop.instagram.handle })} />
          ) : null}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending || !nonce || !turnstileToken}
        className="min-h-14 w-full rounded-sm bg-accent font-bold text-on-accent disabled:opacity-60"
      >
        {pending ? t('confirm.submitting') : t('confirm.submit')}
      </button>
    </form>
  )
}
