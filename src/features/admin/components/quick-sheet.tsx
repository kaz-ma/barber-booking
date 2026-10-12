'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { createTimeBlockAction, deleteTimeBlockAction } from '../actions'
import { S } from '../strings'
import type { OverlapDTO } from '../types'
import { Icon } from './icon'
import { Sheet } from './sheet'
import { floor5, hhmm, isoAt, nowMinutes } from './time-utils'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/*
 * FAB "＋ 追加" → QuickActionSheet (DES-03 §6.3 / §8, 05_block comp, AT-21): manual booking,
 * presets 今から 1 時間 / 2 時間 / 今日はここまで / 期間を指定. Each row shows its range, the
 * kind it saves as, the customer-site effect and any overlap (checked when the sheet opens).
 * A row without overlap saves in two taps; an overlapping one needs "それでも…" (force).
 * Tapping a free gap opens the same sheet anchored at that time.
 */

type PresetKey = 'now60' | 'now120' | 'untilClose' | 'anchor' | 'range'
type Kind = 'break' | 'private' | 'closed'

type Preset = {
  key: PresetKey
  title: string
  startMin: number
  endMin: number
  kind: Kind
  overlaps: OverlapDTO[] | null
}

export function QuickSheet(props: {
  open: boolean
  onClose: () => void
  date: string
  isToday: boolean
  closeMin: number | null
  leadTimeMin: number
  anchorMin: number | null
  /** Captured when the sheet was opened (event handler), so rendering stays pure. */
  openedAt: number
}) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={S.sheet.addTitle} className="bs">
      {props.open ? <QuickSheetBody key={props.openedAt} {...props} /> : null}
    </Sheet>
  )
}

function buildPresets(date: string, isToday: boolean, closeMin: number | null, anchorMin: number | null, nowMin: number) {
  const list: Preset[] = []
  if (anchorMin !== null) {
    list.push({ key: 'anchor', title: S.sheet.startAt(hhmm(anchorMin)), startMin: anchorMin, endMin: anchorMin + 60, kind: 'break', overlaps: null })
    return list
  }
  if (!isToday) return list
  const s = floor5(nowMin)
  list.push({ key: 'now60', title: S.sheet.now60, startMin: s, endMin: s + 60, kind: 'break', overlaps: null })
  list.push({ key: 'now120', title: S.sheet.now120, startMin: s, endMin: s + 120, kind: 'break', overlaps: null })
  if (closeMin !== null && closeMin > s) {
    list.push({ key: 'untilClose', title: S.sheet.untilClose, startMin: s, endMin: closeMin, kind: 'closed', overlaps: null })
  }
  void date
  return list
}

function QuickSheetBody({
  onClose,
  date,
  isToday,
  closeMin,
  leadTimeMin,
  anchorMin,
  openedAt,
}: {
  onClose: () => void
  date: string
  isToday: boolean
  closeMin: number | null
  leadTimeMin: number
  anchorMin: number | null
  openedAt: number
}) {
  const toast = useToast()
  const nowMin = nowMinutes(date, new Date(openedAt))
  const base = useMemo(
    () => buildPresets(date, isToday, closeMin, anchorMin, nowMin),
    [date, isToday, closeMin, anchorMin, nowMin],
  )
  const [overlapsByKey, setOverlapsByKey] = useState<Partial<Record<PresetKey, OverlapDTO[]>>>({})
  const presets = base.map((p) => ({ ...p, overlaps: overlapsByKey[p.key] ?? null }))
  const [selected, setSelected] = useState<PresetKey>(() => base[0]?.key ?? 'range')
  const [kind, setKind] = useState<Kind>(() => base[0]?.kind ?? 'break')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    // Overlap check per row when the sheet opens (GET /api/admin/overlaps).
    const ctrl = new AbortController()
    for (const p of base) {
      const qs = new URLSearchParams({ start: isoAt(date, p.startMin), end: isoAt(date, p.endMin) })
      fetch(`/api/admin/overlaps?${qs}`, { cache: 'no-store', signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { overlaps: [] }))
        .then((d: { overlaps: OverlapDTO[] }) => {
          const bookingsOnly = d.overlaps.filter((o) => o.kind === 'booking')
          setOverlapsByKey((cur) => ({ ...cur, [p.key]: bookingsOnly }))
        })
        .catch(() => {})
    }
    return () => ctrl.abort()
  }, [base, date])

  const current = presets.find((p) => p.key === selected) ?? null
  const firstBookable = nowMin + leadTimeMin
  const impact = (p: Preset) =>
    isToday && p.endMin <= firstBookable ? S.sheet.impactNone : S.sheet.impactUntil(hhmm(p.endMin))
  const range = current ? `${hhmm(current.startMin)}–${hhmm(current.endMin)}` : ''
  const hasOverlap = Boolean(current?.overlaps && current.overlaps.length > 0)

  function save() {
    if (!current) return
    setError(null)
    startTransition(async () => {
      const base = { kind, label, force: hasOverlap }
      const input =
        current.key === 'now60' || current.key === 'now120' || current.key === 'untilClose'
          ? { ...base, preset: current.key }
          : { ...base, start: isoAt(date, current.startMin), end: isoAt(date, current.endMin) }
      const res = await createTimeBlockAction(input)
      if (res.status !== 'ok') {
        setError(describeFailure(res))
        return
      }
      onClose()
      const until = res.data.publicImpactUntil ? hhmm(nowMinutes(date, new Date(res.data.publicImpactUntil))) : null
      toast.show({
        message: S.sheet.blockedToast(
          `${hhmm(nowMinutes(date, new Date(res.data.start)))}–${hhmm(nowMinutes(date, new Date(res.data.end)))}`,
        ),
        sub: until ? S.sheet.impactToastUntil(until) : S.sheet.impactToastNone,
        undo: async () => {
          await deleteTimeBlockAction({ blockId: res.data.blockId })
        },
      })
    })
  }

  const manualHref = `/admin/bookings/new?date=${date}${anchorMin !== null ? `&start=${hhmm(anchorMin)}` : ''}`

  return (
    <>
      <Link className="row-link" href={manualHref as '/admin/bookings/new'}>
        <Icon name="userplus" />
        <span className="grow">{anchorMin !== null ? S.sheet.manualAt(hhmm(anchorMin)) : S.sheet.manual}</span>
        <Icon name="chev-r" />
      </Link>
      <fieldset>
        <legend className="legend">
          {S.sheet.blockLegend}
          {isToday && anchorMin === null ? <span className="cap">{S.sheet.blockLegendCap(hhmm(nowMin))}</span> : null}
        </legend>
        <div className="presets">
          {presets.map((p) => (
            <label className="preset" key={p.key}>
              <input
                className="vh-input"
                type="radio"
                name="preset"
                value={p.key}
                checked={selected === p.key}
                onChange={() => {
                  setSelected(p.key)
                  setKind(p.kind)
                }}
              />
              <span className="box">
                <span className="rd" aria-hidden="true" />
                <b>{p.title}</b>
                <span className="rng">
                  {hhmm(p.startMin)}–{hhmm(p.endMin)}
                </span>
                <span className="sub">
                  <b>{S.blockKind[p.kind]}</b>
                  {S.sheet.asSuffix} ・ {impact(p)}
                </span>
                {p.overlaps && p.overlaps.length > 0 ? (
                  <span className="ov">
                    <Icon name="alert" />
                    <span>
                      {p.overlaps
                        .map((o) =>
                          S.sheet.overlapWith(
                            `${hhmm(nowMinutes(date, new Date(o.start)))}–${hhmm(nowMinutes(date, new Date(o.end)))}`,
                            o.label,
                          ),
                        )
                        .join('、')}
                    </span>
                  </span>
                ) : null}
              </span>
            </label>
          ))}
          <Link className="preset" href={`/admin/blocks/new?date=${date}` as '/admin/blocks/new'}>
            <span className="box">
              <span className="rd" aria-hidden="true" />
              <b>{S.sheet.range}</b>
              <span className="rng">{S.sheet.rangePick}</span>
              <span className="sub">{S.sheet.rangeSub}</span>
            </span>
          </Link>
        </div>
      </fieldset>
      {current ? (
        <>
          <div className="kind-row">
            <fieldset className="field">
              <legend className="label">
                {S.sheet.kindLegend}
                <span className="req">{S.sheet.kindHelp}</span>
              </legend>
              <div className="seg-row">
                {(['break', 'private', 'closed'] as const).map((k) => (
                  <label key={k}>
                    <input
                      className="vh-input"
                      type="radio"
                      name="kind"
                      checked={kind === k}
                      onChange={() => setKind(k)}
                    />
                    <span>{S.blockKind[k]}</span>
                  </label>
                ))}
              </div>
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
                autoComplete="off"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>
          <p className="effect" role="status">
            <Icon name="info" />
            <span>
              {hasOverlap ? <b>{S.sheet.overlapNote}</b> : <b>{S.sheet.noOverlap}</b>}
              {S.sheet.leadNote(leadTimeMin)}
            </span>
          </p>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="btn btn-primary btn-block"
            type="button"
            onClick={save}
            disabled={pending}
            aria-busy={pending}
          >
            <span className="num">{hasOverlap ? S.sheet.forceCta(range) : S.sheet.blockCta(range)}</span>
          </button>
        </>
      ) : null}
    </>
  )
}
