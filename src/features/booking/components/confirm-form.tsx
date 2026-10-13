'use client'

import type { Route } from 'next'
import { useRouter as useNextRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type FormEvent, type ReactNode, useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldError } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { InstagramLink } from '@/components/ui/instagram-link'
import { shop } from '@/config/shop'
import { applicablePrice, isStudentRateApplied } from '@/domain/pricing'
import { formatDateTime, formatDayOf, formatTimeSpan } from '@/lib/i18n/display'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { type CreateBookingState, createBooking } from '../actions'
import { clearDraft, type Draft, loadDraft, useDraft, useSubmissionNonce } from '../draft'
import { asErrorKey, type BookingErrorKey, resultMessageKey } from '../messages'
import { firstIncompleteStage } from '../validate'
import { yenText } from './price'
import { TurnstileWidget } from './turnstile-widget'
import type { BookingMenu } from './types'

type SubmitState = CreateBookingState | typeof NETWORK
const NETWORK = { status: 'network' } as const

/** Placeholder token when no site key is configured (local dev; the server skips siteverify). */
const DEV_TURNSTILE_TOKEN = 'turnstile-not-configured'

/** Results that offer the Instagram DM as the way forward (HE-02). */
const WITH_INSTAGRAM: BookingErrorKey[] = ['rateLimited', 'duplicate', 'restricted', 'error', 'botCheckFailed']

/**
 * S-C-04 ④ 確認 (FR-C-09/10): check-answers rows with "変更" (price and duration have none),
 * cancellation summary, privacy note, required consent (the submit button stays focusable with
 * aria-disabled and explains itself when pressed), Turnstile + honeypot, then createBooking via
 * useActionState. Expected failures come back as values and render an error summary.
 */
export function ConfirmForm({
  menus,
  turnstileSiteKey,
  cancelDeadlineMin,
}: {
  menus: BookingMenu[]
  turnstileSiteKey?: string
  cancelDeadlineMin: number
}) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const nextRouter = useNextRouter()
  const draft = useDraft()
  const nonce = useSubmissionNonce()
  const [turnstileToken, setTurnstileToken] = useState(turnstileSiteKey ? '' : DEV_TURNSTILE_TOKEN)
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState(false)
  // A thrown action (network drop, or a page loaded before a redeploy whose action id no longer
  // exists) must not end on the error page: keep the draft and offer a reload (S-C-04 §5).
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(async (prev, form) => {
    try {
      return await createBooking(prev?.status === 'network' ? null : prev, form)
    } catch {
      return NETWORK
    }
  }, null)
  const alertRef = useRef<HTMLDivElement>(null)
  const consentRef = useRef<HTMLInputElement>(null)
  const menu = draft ? menus.find((m) => m.slug === draft.menuSlug) : undefined

  // Missing / incomplete draft → back to the step that needs input (03_screen_specs §3.4).
  useEffect(() => {
    if (draft === undefined || state?.status === 'ok') return
    if (draft === null || !menu) {
      router.replace('/?step=menu#book')
    } else if (!draft.startsAt) {
      router.replace('/?step=time#book')
    } else if (firstIncompleteStage(draft, locale)) {
      router.replace('/?step=info#book')
    }
  }, [draft, menu, locale, router, state])

  useEffect(() => {
    if (!state) return
    if (state.status === 'ok') {
      clearDraft()
      // doneUrl is already locale-prefixed: use the plain Next router.
      nextRouter.replace(state.data.doneUrl as Route)
    } else if (
      state.status === 'conflict' ||
      state.status === 'duplicate' ||
      (state.status === 'invalid' && state.reason === 'not_bookable')
    ) {
      // The slot was just taken, or is no longer offered (lead time passed, closed meanwhile):
      // back to the date step on the top page with a banner (AT-03, DES-06 §5, CR-14).
      if (loadDraft()) {
        router.push(`/?step=time&taken=${state.status === 'invalid' ? 'deadline' : '1'}#book`)
      }
    } else {
      alertRef.current?.focus()
    }
  }, [state, nextRouter, router])

  if (state?.status === 'ok') return <p role="status">{t('confirm.submitting')}</p>
  if (!draft || !menu || !draft.startsAt || firstIncompleteStage(draft, locale)) {
    return <div className="min-h-96" aria-hidden="true" />
  }

  const navigatesAway =
    state?.status === 'conflict' ||
    state?.status === 'duplicate' ||
    (state?.status === 'invalid' && state.reason === 'not_bookable')
  const messageKey = navigatesAway ? null : state?.status === 'network' ? 'network' : resultMessageKey(state)
  const fieldErrors = state?.status === 'invalid' ? state.fieldErrors : {}
  const ready = consent && !!nonce && !!turnstileToken && !pending

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (pending) {
      e.preventDefault()
      return
    }
    if (!consent) {
      e.preventDefault()
      setConsentError(true)
      consentRef.current?.focus()
      return
    }
    if (!nonce || !turnstileToken) e.preventDefault()
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate>
      {messageKey ? (
        <div className="alert" role="alert" tabIndex={-1} ref={alertRef} aria-labelledby="alert-h">
          <h2 id="alert-h">
            <Icon name="alert" />
            <span>
              <span className="sr-only">{t('common.errorPrefix')}</span>
              {t('booking.errors.summaryTitle')}
            </span>
          </h2>
          <p>{t(`booking.errors.${messageKey}`)}</p>
          {Object.keys(fieldErrors).length > 0 ? (
            <ul>
              {Object.entries(fieldErrors).map(([field, keys]) => (
                <li key={field}>{t(`booking.errors.${asErrorKey(keys[0])}`)}</li>
              ))}
            </ul>
          ) : null}
          {messageKey === 'network' ? (
            <Button variant="secondary" block onClick={() => window.location.reload()}>
              {t('booking.errors.reload')}
            </Button>
          ) : null}
          {WITH_INSTAGRAM.includes(messageKey) ? <InstagramLink variant="button" /> : null}
        </div>
      ) : null}

      <h1 className="page-h" id="cf-h">
        {t('confirm.heading')}
      </h1>
      <p className="lead">{t('confirm.lead')}</p>

      <CheckAnswers draft={draft} menu={menu} />

      <section className="digest" aria-labelledby="dg-h">
        <h2 id="dg-h">
          <Icon name="clock" />
          {t('confirm.digestTitle')}
        </h2>
        <p>
          {t.rich('confirm.digest', {
            hours: cancelDeadlineMin / 60,
            deadline: formatDateTime(new Date(new Date(draft.startsAt).getTime() - cancelDeadlineMin * 60_000), locale),
            handle: shop.instagram.handle,
            b: (c) => <b>{c}</b>,
          })}
        </p>
        <Link className="btn btn-ghost" href="/policy">
          {t('confirm.readPolicy')}
        </Link>
      </section>

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

      <p className="privacy">{t('confirm.privacy')}</p>
      <Link className="btn btn-ghost" href="/privacy">
        {t('confirm.readPrivacy')}
      </Link>
      <Checkbox
        ref={consentRef}
        name="consent"
        value="on"
        checked={consent}
        onChange={(e) => {
          setConsent(e.target.checked)
          if (e.target.checked) setConsentError(false)
        }}
        label={t('confirm.consent')}
        tag={t('common.required')}
        invalid={consentError}
        aria-describedby={consentError ? 'consent-err' : undefined}
      />
      {consentError ? (
        <div className="mt-2">
          <FieldError id="consent-err" prefix={t('common.errorPrefix')} message={t('booking.errors.consentRequired')} />
        </div>
      ) : null}

      {turnstileSiteKey ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          locale={locale}
          cData={nonce}
          onToken={setTurnstileToken}
          // siteverify consumes a token once (SR-03): any failed submit needs a fresh one.
          resetOn={state}
        />
      ) : (
        <div className="turnstile-dev" aria-hidden="true">
          <Icon name="shield" />
          <span>
            <b>{t('confirm.turnstileTitle')}</b>
            {t('confirm.turnstileDev')}
          </span>
        </div>
      )}

      <div className="sticky-cta paper">
        <div className="in">
          <Button
            type="submit"
            variant="primary"
            block
            aria-disabled={!ready || undefined}
            aria-busy={pending || undefined}
            aria-describedby="submit-hint"
          >
            {pending ? t('confirm.submitting') : t('confirm.submit')}
          </Button>
          <p className="hint" id="submit-hint">
            {consent ? t('confirm.hintReady') : t('confirm.hintUnchecked')}
          </p>
        </div>
      </div>
    </form>
  )
}

function CheckAnswers({ draft, menu }: { draft: Draft; menu: BookingMenu }) {
  const t = useTranslations('confirm')
  const tc = useTranslations('common')
  const tForm = useTranslations('booking.form')
  const tMenu = useTranslations('menu')
  const locale = useLocale() as 'ja' | 'en'
  const start = new Date(draft.startsAt)
  const end = new Date(start.getTime() + menu.durationMin * 60_000)
  const occupation = draft.occupation || 'worker'
  const price = applicablePrice(menu, occupation)
  const isStudentRate = occupation === 'student' && isStudentRateApplied(menu, occupation)

  const rows: { key: string; label: string; value: ReactNode; edit?: Parameters<typeof Link>[0]['href'] }[] = [
    {
      key: 'menu',
      label: t('menu'),
      value: menu.name[locale],
      edit: '/?step=menu#book',
    },
    {
      key: 'price',
      label: t('price'),
      value: (
        <>
          <span className="p">{yenText(price)}</span>
          {price ? null : <span className="sr-only">{tc('priceUnsetSr')}</span>}
          {isStudentRate ? (
            <>
              <span className="tag">{t('studentRate')}</span>
              <small>{t('studentApplied', { price: yenText(menu.priceJpy) })}</small>
            </>
          ) : null}
        </>
      ),
    },
    { key: 'duration', label: t('duration'), value: tMenu('duration', { minutes: menu.durationMin }) },
    {
      key: 'date',
      label: t('date'),
      value: (
        <>
          <b>{formatDayOf(start, locale)}</b>
          <br />
          <b className="num">{formatTimeSpan(start, end, locale)}</b>
          {t('jst')}
        </>
      ),
      edit: '/?step=time#book',
    },
    {
      key: 'name',
      label: t('name'),
      value: (
        <>
          {draft.name}
          {locale === 'ja' && draft.nameKana ? (
            <>
              <br />
              {tForm('kanaSummary', { kana: draft.nameKana })}
            </>
          ) : null}
        </>
      ),
      edit: '/?step=info#book',
    },
    {
      key: 'occupation',
      label: t('occupation'),
      value: draft.occupation ? tForm(draft.occupation) : '',
      edit: '/?step=info#book',
    },
    {
      key: 'phone',
      label: t('phone'),
      value: <span className="num">{draft.phone}</span>,
      edit: '/?step=info#book',
    },
    {
      key: 'note',
      label: t('note'),
      value: draft.note.trim() ? <span className="whitespace-pre-line">{draft.note}</span> : t('noteNone'),
      edit: '/?step=info#book',
    },
  ]

  return (
    <Card as="dl" className="answers" aria-labelledby="cf-h">
      {rows.map((r) => (
        <div key={r.key} className="ans">
          <dt>{r.label}</dt>
          <dd>
            <span className="v">{r.value}</span>
            {r.edit ? (
              <Link className="btn btn-ghost" href={r.edit} aria-label={t('changeAria', { item: r.label })}>
                {tc('change')}
              </Link>
            ) : null}
          </dd>
        </div>
      ))}
    </Card>
  )
}
