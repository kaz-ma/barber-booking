'use client'

import { useEffect, useState, useTransition } from 'react'
import { type BookingStatus, stepBackTarget } from '@/domain/booking-status'
import {
  acknowledgeBookingAction,
  deleteBookingAction,
  reissueConfirmationUrlAction,
  stepBackBookingStatusAction,
  undoBookingChangeAction,
  updateBookingStatusAction,
  updateOwnerNoteAction,
} from '../actions'
import { S } from '../strings'
import { useNowMinute } from './client-hooks'
import { Icon } from './icon'
import { useInbox } from './inbox-provider'
import { Sheet } from './sheet'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/*
 * S-A-04 actions (FR-A-04, 05 §1.1): progress buttons (来店 → 施術開始 → 完了), the three
 * cancellation outcomes executed immediately with a 5-second undo toast, confirmation URL
 * (re)issue + copy, owner memo. Opening the page acknowledges the booking (FR-A-11).
 */

type Props = {
  bookingId: string
  status: BookingStatus
  source: string
  locale: 'ja' | 'en'
  startIso: string
  unacknowledged: boolean
  ownerNote: string | null
  deleted: boolean
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function BookingActions(props: Props) {
  const { bookingId, status } = props
  const toast = useToast()
  const { setCount } = useInbox()
  const nowMs = useNowMinute()
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState<string | null>(null)
  const [urlLocale, setUrlLocale] = useState<'ja' | 'en'>(props.locale)
  const [note, setNote] = useState(props.ownerNote ?? '')
  const [noteSaved, setNoteSaved] = useState(props.ownerNote ?? '')
  const [cancelOpen, setCancelOpen] = useState(false)

  useEffect(() => {
    if (!props.unacknowledged) return
    void acknowledgeBookingAction({ bookingId }).then((res) => {
      if (res.status === 'ok') setCount(res.data.unacknowledged)
    })
  }, [bookingId, props.unacknowledged, setCount])

  function change(to: BookingStatus, opts: { lateMinutes?: number } = {}) {
    startTransition(async () => {
      const res = await updateBookingStatusAction({ bookingId, to, ...opts })
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? (S.errors.generic as string) })
        return
      }
      const label = S.status[to] ?? to
      const undoToken = res.data.undoToken
      toast.show({
        message: undoToken ? S.detail.cancelledToast(label) : S.detail.changedToast(label),
        placement: 'bottom',
        ...(undoToken
          ? {
              undo: async () => {
                const r = await undoBookingChangeAction({ undoToken })
                toast.show({ message: describeFailure(r) ?? S.detail.undone, placement: 'bottom' })
              },
            }
          : {}),
      })
    })
  }

  function stepBack(to: BookingStatus) {
    startTransition(async () => {
      const res = await stepBackBookingStatusAction({ bookingId })
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? (S.errors.generic as string) })
        return
      }
      toast.show({ message: S.detail.steppedBack(S.status[to] ?? to), placement: 'bottom' })
    })
  }

  function removeEntry() {
    startTransition(async () => {
      const res = await deleteBookingAction({ bookingId })
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? (S.errors.generic as string) })
        return
      }
      const undoToken = res.data.undoToken
      toast.show({
        message: S.detail.cancelledToast(S.status.cancelled_by_owner as string),
        placement: 'bottom',
        ...(undoToken
          ? {
              undo: async () => {
                const r = await undoBookingChangeAction({ undoToken })
                toast.show({ message: describeFailure(r) ?? S.detail.undone, placement: 'bottom' })
              },
            }
          : {}),
      })
    })
  }

  function issueUrl() {
    startTransition(async () => {
      const res = await reissueConfirmationUrlAction({ bookingId, linkLocale: urlLocale })
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? (S.errors.generic as string) })
        return
      }
      setUrl(res.data.confirmUrl)
      const ok = await copyText(res.data.confirmUrl)
      toast.show({ message: ok ? S.manual.urlCopied : S.detail.urlSection, placement: 'bottom', icon: ok })
    })
  }

  function saveNote() {
    if (note === noteSaved) return
    startTransition(async () => {
      const res = await updateOwnerNoteAction({ bookingId, ownerNote: note })
      const failure = describeFailure(res)
      if (failure) {
        toast.show({ message: failure })
        return
      }
      setNoteSaved(note)
      toast.show({ message: S.detail.memoSaved, placement: 'bottom' })
    })
  }

  const active = ['confirmed', 'arrived', 'in_progress'].includes(status) && !props.deleted
  const backTo = props.deleted ? null : stepBackTarget(status)
  const overdue = status === 'confirmed' && nowMs !== null && nowMs > new Date(props.startIso).getTime() + 30 * 60_000
  // One button for the next step only (来店 → 施術開始 → 完了).
  const next: { to: BookingStatus; label: string } | null =
    status === 'confirmed'
      ? { to: 'arrived', label: S.detail.toArrived }
      : status === 'arrived'
        ? { to: 'in_progress', label: S.detail.toInProgress }
        : status === 'in_progress'
          ? { to: 'completed', label: S.detail.toCompleted }
          : null

  return (
    <>
      {active && next ? (
        <section className="v2-actions" aria-label={S.detail.statusSection}>
          {overdue ? <p className="v2-note">{S.detail.noShowHint}</p> : null}
          <button
            className="btn btn-primary btn-block"
            type="button"
            disabled={pending}
            onClick={() => change(next.to)}
          >
            <Icon name="check" />
            {next.label}
          </button>
          {status === 'confirmed' ? (
            <button className="btn btn-secondary btn-block" type="button" onClick={() => setCancelOpen(true)}>
              <Icon name="x" />
              {S.detail.cancelOpen}
            </button>
          ) : null}
        </section>
      ) : null}

      {backTo ? (
        <div className="center-row">
          <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => stepBack(backTo)}>
            <Icon name="back" />
            {S.detail.stepBack(S.status[backTo] ?? backTo)}
          </button>
        </div>
      ) : null}

      <div className="field v2-memo-field">
        <label className="label" htmlFor="memo">
          {S.detail.memo}
          <span className="req">{S.detail.memoHelp}</span>
        </label>
        <textarea
          id="memo"
          className="input"
          rows={2}
          maxLength={500}
          placeholder={S.detail.memoPlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
        />
      </div>

      {status === 'confirmed' && !props.deleted ? (
        <details className="v2-more">
          <summary>{S.detail.urlSection}</summary>
          <div className="stack">
            <p className="cap">{S.detail.urlHelp}</p>
            <div className="seg-row">
              <label>
                <input
                  className="vh-input"
                  type="radio"
                  name="loc"
                  checked={urlLocale === 'ja'}
                  onChange={() => setUrlLocale('ja')}
                />
                <span>日本語</span>
              </label>
              <label>
                <input
                  className="vh-input"
                  type="radio"
                  name="loc"
                  checked={urlLocale === 'en'}
                  onChange={() => setUrlLocale('en')}
                />
                <span lang="en">English</span>
              </label>
            </div>
            {url ? <p className="urlrow u">{url}</p> : null}
            <button className="btn btn-secondary btn-block" type="button" disabled={pending} onClick={issueUrl}>
              <Icon name="copy" />
              {S.detail.urlIssue}
            </button>
            <p className="cap">{S.detail.urlIssueNote}</p>
          </div>
        </details>
      ) : null}

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title={S.detail.cancelSection}>
        <div className="v2-choices">
          <p className="cap">{S.detail.cancelNote}</p>
          {(
            [
              ['cancelled_by_owner', S.detail.ownerCancel, S.detail.ownerCancelSub],
              ['no_show', S.detail.noShow, S.detail.noShowSub],
              ['cancelled_late', S.detail.lateCancel, S.detail.lateCancelSub],
            ] as const
          ).map(([to, label, sub]) => (
            <button
              key={to}
              className="v2-choice"
              type="button"
              disabled={pending}
              onClick={() => {
                setCancelOpen(false)
                change(to)
              }}
            >
              <span>
                <b>{label}</b>
                <small>{sub}</small>
              </span>
            </button>
          ))}
          {props.source !== 'web' ? (
            <button
              className="v2-choice"
              type="button"
              disabled={pending}
              onClick={() => {
                setCancelOpen(false)
                removeEntry()
              }}
            >
              <span>
                <b>{S.detail.deleteEntry}</b>
                <small>{S.detail.deleteEntrySub}</small>
              </span>
            </button>
          ) : null}
        </div>
      </Sheet>
    </>
  )
}
