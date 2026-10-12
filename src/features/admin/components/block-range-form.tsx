'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { jstInstant } from '@/domain/jst-format'
import { toJstIso } from '@/domain/time'
import { createTimeBlockAction, deleteTimeBlockAction } from '../actions'
import { errorText, S } from '../strings'
import type { OverlapDTO } from '../types'
import { Icon } from './icon'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/*
 * S-A-06 期間指定 (DES-03 §8): kind, start / end (5-minute steps, ≤ 60 days), label. Overlapping
 * active bookings are listed and the block is only saved with 「それでもブロック」 (the bookings
 * stay). Multi-day closures use 臨時休業 (`closed`).
 */

type Kind = 'break' | 'private' | 'closed'
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const isoOf = (date: string, time: string) => (date && time ? toJstIso(jstInstant(date, toMin(time))) : '')

export function BlockRangeForm({ initialDate }: { initialDate: string }) {
  const router = useRouter()
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('closed')
  const [startDate, setStartDate] = useState(initialDate)
  const [startTime, setStartTime] = useState('18:00')
  const [endDate, setEndDate] = useState(initialDate)
  const [endTime, setEndTime] = useState('23:55')
  const [label, setLabel] = useState('')
  const [fetched, setFetched] = useState<OverlapDTO[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const start = isoOf(startDate, startTime)
  const end = isoOf(endDate, endTime)
  const valid = Boolean(start && end && Date.parse(end) > Date.parse(start))

  const overlaps = valid ? fetched : []

  useEffect(() => {
    if (!valid) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/admin/overlaps?${new URLSearchParams({ start, end })}`, { signal: ctrl.signal, cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { overlaps: [] }))
        .then((d: { overlaps: OverlapDTO[] }) => setFetched(d.overlaps.filter((o) => o.kind === 'booking')))
        .catch(() => {})
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [start, end, valid])

  function save() {
    setError(null)
    if (!valid) {
      setError(errorText('endBeforeStart'))
      return
    }
    startTransition(async () => {
      const res = await createTimeBlockAction({ start, end, kind, label, force: overlaps.length > 0 })
      if (res.status !== 'ok') {
        setError(describeFailure(res))
        return
      }
      router.push(`/admin?date=${startDate}`)
      toast.show({
        message: S.sheet.blockedToast(`${startDate.slice(5).replace('-', '/')} ${startTime}–${endTime}`),
        sub: res.data.publicImpactUntil ? S.sheet.impactToastUntil(endTime) : S.sheet.impactToastNone,
        undo: async () => {
          await deleteTimeBlockAction({ blockId: res.data.blockId })
        },
      })
    })
  }

  return (
    <>
      <header className="ah paper">
        <Link className="icon-btn" href={`/admin?date=${initialDate}`} aria-label={S.back}>
          <Icon name="back" />
        </Link>
        <h1>{S.blockForm.title}</h1>
      </header>
      <main className="wrap form has-cta">
        <fieldset className="field">
          <legend className="label">{S.sheet.kindLegend}</legend>
          <div className="seg-row">
            {(['break', 'private', 'closed'] as const).map((k) => (
              <label key={k}>
                <input className="vh-input" type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
                <span>{S.blockKind[k]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend className="label">{S.blockForm.start}</legend>
          <div className="range-row">
            <input
              className="input num"
              type="date"
              aria-label={`${S.blockForm.start} ${S.blockForm.date}`}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (e.target.value > endDate) setEndDate(e.target.value)
              }}
            />
            <input
              className="input num"
              type="time"
              step={300}
              aria-label={`${S.blockForm.start} ${S.blockForm.time}`}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </fieldset>
        <fieldset className="field">
          <legend className="label">{S.blockForm.end}</legend>
          <div className="range-row">
            <input
              className="input num"
              type="date"
              aria-label={`${S.blockForm.end} ${S.blockForm.date}`}
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <input
              className="input num"
              type="time"
              step={300}
              aria-label={`${S.blockForm.end} ${S.blockForm.time}`}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <p className="help">{S.sheet.rangeSub}</p>
        </fieldset>
        <div className="field">
          <label className="label" htmlFor="blabel">
            {S.sheet.label}
            <span className="req">{S.sheet.labelHelp}</span>
          </label>
          <input
            id="blabel"
            className="input"
            type="text"
            maxLength={50}
            placeholder={S.sheet.labelPlaceholder}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        {overlaps.length > 0 ? (
          <div className="alert" role="alert">
            <p className="alert-ttl">
              <Icon name="alert" />
              {S.blockForm.overlapTitle}
            </p>
            {overlaps.map((o) => (
              <p key={o.id}>
                <span className="num">
                  {o.start.slice(5, 10).replace('-', '/')} {o.start.slice(11, 16)}–{o.end.slice(11, 16)}
                </span>{' '}
                {o.label}
                {S.blockForm.overlapKeep}
              </p>
            ))}
          </div>
        ) : null}
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </main>
      <div className="cta-bar">
        <button className="btn btn-primary btn-block" type="button" disabled={pending} onClick={save}>
          {overlaps.length > 0 ? S.sheet.forceCta('') : S.sheet.blockCta('')}
        </button>
      </div>
    </>
  )
}
