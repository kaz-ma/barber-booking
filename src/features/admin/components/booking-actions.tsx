'use client'

import { useEffect, useState, useTransition } from 'react'
import type { BookingStatus } from '@/domain/booking-status'
import {
  acknowledgeBookingAction,
  deleteBookingAction,
  reissueConfirmationUrlAction,
  undoBookingChangeAction,
  updateBookingStatusAction,
  updateOwnerNoteAction,
} from '../actions'
import { S } from '../strings'
import { useNowMinute } from './client-hooks'
import { Icon } from './icon'
import { useInbox } from './inbox-provider'
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
  const [lateMinutes, setLateMinutes] = useState('')

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

  const progressIndex = status === 'confirmed' ? 0 : status === 'arrived' ? 1 : status === 'in_progress' ? 2 : 3
  const active = ['confirmed', 'arrived', 'in_progress'].includes(status) && !props.deleted
  const overdue = status === 'confirmed' && nowMs !== null && nowMs > new Date(props.startIso).getTime() + 30 * 60_000

  const step = (index: number, label: string, to: BookingStatus, why: string) => {
    const current = progressIndex === index && active
    const done = progressIndex > index
    return (
      <li>
        <span className={`n ${current ? 'cur' : ''}`} aria-hidden="true">
          {done ? '✓' : index + 1}
        </span>
        {current ? (
          <button
            className="btn btn-primary"
            type="button"
            disabled={pending}
            onClick={() =>
              change(to, to === 'arrived' && lateMinutes !== '' ? { lateMinutes: Number(lateMinutes) } : {})
            }
          >
            <Icon name="check" />
            {label}
          </button>
        ) : (
          <>
            <button
              className="btn btn-secondary is-off"
              type="button"
              aria-disabled="true"
              aria-describedby={done ? undefined : `why-${index}`}
            >
              {label}
            </button>
            {done ? null : (
              <p className="cap why" id={`why-${index}`}>
                {why}
              </p>
            )}
          </>
        )}
      </li>
    )
  }

  return (
    <>
      {active ? (
        <>
          <h3 className="sec-h">
            {S.detail.statusSection}
            <span className="cap">{S.detail.statusFlow}</span>
          </h3>
          <ol className="prog">
            {step(0, S.detail.toArrived, 'arrived', '')}
            {step(1, S.detail.toInProgress, 'in_progress', S.detail.whyInProgress)}
            {step(2, S.detail.toCompleted, 'completed', S.detail.whyCompleted)}
          </ol>
          {status === 'confirmed' ? (
            <div className="field mt-2" style={{ maxWidth: '12em' }}>
              <label className="label" htmlFor="late">
                {S.detail.lateMinutes}
                <span className="req">{S.optional}</span>
              </label>
              <input
                id="late"
                className="input num"
                type="number"
                inputMode="numeric"
                min={0}
                max={180}
                value={lateMinutes}
                onChange={(e) => setLateMinutes(e.target.value)}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {status === 'confirmed' && !props.deleted ? (
        <>
          <h3 className="sec-h">{S.detail.cancelSection}</h3>
          {overdue ? (
            <p className="banner warn" role="status">
              <Icon name="alert" />
              <span>{S.detail.noShowHint}</span>
            </p>
          ) : null}
          <p className="cx-note">
            <Icon name="info" />
            <span>{S.detail.cancelNote}</span>
          </p>
          <div className="cx">
            <button className="btn btn-secondary" type="button" disabled={pending} onClick={() => change('no_show')}>
              <Icon name="x" />
              <b>{S.detail.noShow}</b>
              <small>{S.detail.noShowSub}</small>
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={pending}
              onClick={() => change('cancelled_by_owner')}
            >
              <Icon name="x" />
              <b>{S.detail.ownerCancel}</b>
              <small>{S.detail.ownerCancelSub}</small>
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={pending}
              onClick={() => change('cancelled_late')}
            >
              <Icon name="x" />
              <b>{S.detail.lateCancel}</b>
              <small>{S.detail.lateCancelSub}</small>
            </button>
            {props.source !== 'web' ? (
              <button className="btn btn-secondary" type="button" disabled={pending} onClick={removeEntry}>
                <Icon name="x" />
                <b>{S.detail.deleteEntry}</b>
                <small>{S.detail.deleteEntrySub}</small>
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <section className="url-sec" aria-labelledby="url-h">
        <h3 className="sec-h" id="url-h">
          {S.detail.urlSection}
        </h3>
        {status === 'confirmed' && !props.deleted ? (
          <div className="stack">
            <fieldset className="field">
              <legend className="label">{S.detail.urlLocale}</legend>
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
            </fieldset>
            {url ? (
              <div className="urlrow">
                <span className="u">{url}</span>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={async () => {
                    const ok = await copyText(url)
                    toast.show({ message: ok ? S.manual.urlCopied : url, placement: 'bottom', icon: ok })
                  }}
                >
                  <Icon name="copy" />
                  {S.copy}
                </button>
              </div>
            ) : null}
            <button className="btn btn-secondary btn-block" type="button" disabled={pending} onClick={issueUrl}>
              <Icon name="copy" />
              {S.detail.urlIssue}
            </button>
            <p className="cap">{S.detail.urlHelp}</p>
            <p className="cap">{S.detail.urlIssueNote}</p>
          </div>
        ) : (
          <p className="cap">{S.detail.urlUnavailable}</p>
        )}
      </section>

      <div className="field memo">
        <label className="label" htmlFor="memo">
          {S.detail.memo}
          <span className="req">{S.detail.memoHelp}</span>
        </label>
        <textarea
          id="memo"
          className="input"
          rows={3}
          maxLength={500}
          placeholder={S.detail.memoPlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
        />
      </div>
    </>
  )
}
