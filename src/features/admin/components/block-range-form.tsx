'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { jstInstant } from '@/domain/jst-format'
import { addDays, toJstIso } from '@/domain/time'
import { createTimeBlockAction, deleteTimeBlockAction } from '../actions'
import { errorText, S } from '../strings'
import type { OverlapDTO } from '../types'
import { Icon } from './icon'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/*
 * S-A-06 休みを入れる (simplified 2026-10-13): kind, one date with 終日 (whole day, optionally up
 * to a last date) or a 30-minute start / end, and an optional label. Overlapping active bookings
 * are listed and the block is only saved with 「それでもブロック」 (the bookings stay).
 */

type Kind = 'break' | 'private' | 'closed'
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const isoOf = (date: string, time: string) => (date && time ? toJstIso(jstInstant(date, toMin(time))) : '')
/** 00:00 … 24:00 every 30 minutes; 24:00 means midnight at the end of the day. */
const TIMES = Array.from(
  { length: 49 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
)

export function BlockRangeForm({ initialDate }: { initialDate: string }) {
  const router = useRouter()
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('break')
  const [startDate, setStartDate] = useState(initialDate)
  const [allDay, setAllDay] = useState(false)
  const [lastDate, setLastDate] = useState(initialDate)
  const [startTime, setStartTime] = useState('20:00')
  const [endTime, setEndTime] = useState('21:00')
  const [label, setLabel] = useState('')
  const [fetched, setFetched] = useState<OverlapDTO[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const start = allDay ? isoOf(startDate, '00:00') : isoOf(startDate, startTime)
  const end = allDay
    ? isoOf(addDays(lastDate < startDate ? startDate : lastDate, 1), '00:00')
    : endTime === '24:00'
      ? isoOf(addDays(startDate, 1), '00:00')
      : isoOf(startDate, endTime)
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
        message: S.sheet.blockedToast(
          `${startDate.slice(5).replace('-', '/')} ${allDay ? S.blockForm.allDay : `${startTime}–${endTime}`}`,
        ),
        sub: res.data.publicImpactUntil
          ? S.sheet.impactToastUntil(allDay ? '24:00' : endTime)
          : S.sheet.impactToastNone,
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
      <main className="wrap form has-cta v2-form">
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
        <div className="field">
          <label className="label" htmlFor="bdate">
            {S.blockForm.date}
          </label>
          <input
            id="bdate"
            className="input num"
            type="date"
            value={startDate}
            onChange={(e) => {
              if (!e.target.value) return
              setStartDate(e.target.value)
              if (lastDate < e.target.value) setLastDate(e.target.value)
            }}
          />
        </div>
        <label className="v2-switch">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span>{S.blockForm.allDay}</span>
        </label>
        {allDay ? (
          <div className="field">
            <label className="label" htmlFor="blast">
              {S.blockForm.lastDate}
              <span className="req">{S.blockForm.lastDateHelp}</span>
            </label>
            <input
              id="blast"
              className="input num"
              type="date"
              min={startDate}
              value={lastDate}
              onChange={(e) => e.target.value && setLastDate(e.target.value)}
            />
          </div>
        ) : (
          <div className="v2-times">
            <label className="field">
              <span className="label">{S.blockForm.start}</span>
              <select className="input num" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                {TIMES.slice(0, -1).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <span aria-hidden="true">〜</span>
            <label className="field">
              <span className="label">{S.blockForm.end}</span>
              <select className="input num" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                {TIMES.slice(1).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
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
