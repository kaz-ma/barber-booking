'use client'

import { useTranslations } from 'next-intl'
import { type ReactNode, useActionState, useCallback, useRef, useState } from 'react'
import { Button, LinkButton } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { InstagramLink } from '@/components/ui/instagram-link'
import { Link } from '@/lib/i18n/navigation'
import { type CancelBookingState, cancelBooking } from '../actions'

/**
 * S-C-06 (a)–(c): the page GET has no side effects (link previews must not cancel, T-10).
 * "この予約をキャンセルする" opens a native <dialog> bottom sheet whose initial focus is the safe
 * "予約を残す"; only "予約を取り消す" posts the Server Action. Results swap the whole view:
 * cancelled → (c), past deadline → `pastDeadline`, anything else → `notFound` / error text.
 */
export function CancelFlow({
  token,
  locale,
  summary,
  publicCode,
  deadlineLabel,
  card,
  pastDeadline,
  notFound,
}: {
  token: string
  locale: 'ja' | 'en'
  summary: string
  publicCode: string
  deadlineLabel: string
  card: ReactNode
  pastDeadline: ReactNode
  notFound: ReactNode
}) {
  const t = useTranslations('cancel')
  const tc = useTranslations('contact')
  const tErr = useTranslations('errors')
  const tDone = useTranslations('done')
  const keepRef = useRef<HTMLButtonElement>(null)
  const [state, formAction, pending] = useActionState<CancelBookingState, FormData>(cancelBooking, null)
  // The sheet is open while the action result is still the one it was opened with: a new result
  // (any status) closes it without an effect.
  const [openedWith, setOpenedWith] = useState<{ state: CancelBookingState } | null>(null)
  const open = openedWith !== null && openedWith.state === state
  const close = useCallback(() => setOpenedWith(null), [])

  if (state?.status === 'ok') {
    return (
      <>
        <p className="stamp">
          <Icon name="check" />
          {t('stamp')}
          <span lang="en">{t('stampEn')}</span>
        </p>
        <h1 className="title-24 mt-2" tabIndex={-1} ref={(el) => el?.focus()}>
          {t('doneHeading')}
        </h1>
        <p className="mt-2">{t.rich('doneBody', { summary, nw: (c) => <span className="nw">{c}</span> })}</p>
        <p className="told" role="status">
          <Icon name="check" />
          <span>{t('notified')}</span>
        </p>
        <section className="bk off">
          <dl className="dkv mt-0 border-t-0 pt-0">
            <div>
              <dt>{tDone('publicCode')}</dt>
              <dd className="num font-bold tracking-[0.12em]">{publicCode}</dd>
            </div>
            <div>
              <dt>{t('status')}</dt>
              <dd>
                <span className="status-chip">{t('statusCancelled')}</span>
              </dd>
            </div>
          </dl>
        </section>
        <LinkButton href="/#book" variant="primary" block trailingIcon="arrowRight" className="mt-6">
          {t('bookAgain')}
        </LinkButton>
        <p className="note text-center">{t('bookAgainNote')}</p>
        <div className="center-row">
          <Link className="btn btn-ghost" href="/">
            {tErr('toTop')}
          </Link>
        </div>
        <div className="help-ig">
          <p>{tc('help')}</p>
          <InstagramLink variant="button" />
        </div>
      </>
    )
  }
  if (state?.status === 'past_deadline') return <>{pastDeadline}</>
  if (state?.status === 'not_found') return <>{notFound}</>

  return (
    <>
      <h1 className="title-24">{t('heading')}</h1>
      {card}
      {state ? (
        <div className="alert" role="alert">
          <p>{t('failed')}</p>
        </div>
      ) : null}
      <p className="deadline-line">
        <Icon name="clock" />
        <span>{t.rich('deadline', { deadline: deadlineLabel, nw: (c) => <span className="nw">{c}</span> })}</span>
      </p>
      <Button
        variant="danger"
        block
        icon="x"
        className="mt-3"
        aria-haspopup="dialog"
        onClick={() => setOpenedWith({ state })}
      >
        {t('button')}
      </Button>
      <p className="note">{t('changeHint')}</p>
      <div className="help-ig">
        <p>{tc('help')}</p>
        <InstagramLink variant="button" />
      </div>

      <Sheet open={open} onClose={close} titleId="dlg-h" descriptionId="dlg-d" initialFocus={keepRef}>
        <h2 id="dlg-h">{t('dialogTitle')}</h2>
        <p id="dlg-d">{t.rich('dialogBody', { summary, b: (c) => <b>{c}</b> })}</p>
        <form
          action={formAction}
          className="row"
          // A double tap must not queue a second submission while the first is pending (CR-09);
          // the server is idempotent as well (a repeat answers "already cancelled").
          onSubmit={(e) => {
            if (pending) e.preventDefault()
          }}
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="locale" value={locale} />
          <Button ref={keepRef} variant="secondary" onClick={close}>
            {t('keep')}
          </Button>
          <Button type="submit" variant="danger-fill" aria-disabled={pending || undefined}>
            {pending ? t('submitting') : t('confirmButton')}
          </Button>
        </form>
      </Sheet>
    </>
  )
}
