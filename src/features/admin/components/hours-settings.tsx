'use client'

import { useMemo, useState, useTransition } from 'react'
import { formatDateJa, formatMinutes } from '@/domain/jst-format'
import { addDays } from '@/domain/time'
import {
  deleteHourOverrideAction,
  updateBusinessHoursAction,
  updateSettingsAction,
  upsertHourOverrideAction,
} from '../actions'
import type { AdminHours, AdminSettings } from '../queries'
import { S } from '../strings'
import { useNowMinute } from './client-hooks'
import { Icon } from './icon'
import { nowMinutes } from './time-utils'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/*
 * S-A-08 営業時間・休業日・枠ルール (FR-A-07, AT-22). One save for the weekly template and the
 * slot rules; overrides are added / removed individually. Saving calls updateTag(CACHE_TAGS.businessHours /
 * CACHE_TAGS.settings) so the customer site reflects it immediately; availability is never cached.
 */

type Day = AdminHours['week'][number]
const OPEN_OPTIONS = Array.from({ length: 49 }, (_, i) => i * 30)
const toOption = (min: number) => (min === 1440 ? '24:00' : formatMinutes(min))

export function HoursSettings({
  hours,
  settings,
  today,
}: {
  hours: AdminHours
  settings: AdminSettings
  today: string
}) {
  const toast = useToast()
  const [week, setWeek] = useState<Day[]>(hours.week)
  const [rules, setRules] = useState<AdminSettings>(settings)
  const [pending, startTransition] = useTransition()
  const [ovDate, setOvDate] = useState(addDays(today, 1))
  const [ovClosed, setOvClosed] = useState(true)
  const [ovOpen, setOvOpen] = useState(18 * 60)
  const [ovClose, setOvClose] = useState(22 * 60)
  const [ovReason, setOvReason] = useState('')
  const [showOv, setShowOv] = useState(false)

  const changedDays = useMemo(
    () =>
      week.filter((d) => {
        const o = hours.week.find((w) => w.weekday === d.weekday)
        return !o || o.isClosed !== d.isClosed || o.openMin !== d.openMin || o.closeMin !== d.closeMin
      }).length,
    [week, hours.week],
  )
  const changedRules = (Object.keys(settings) as (keyof AdminSettings)[]).filter((k) => settings[k] !== rules[k]).length
  const changes = changedDays + changedRules
  // Monday first, like the comps.
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((wd) => week.find((d) => d.weekday === wd)).filter(Boolean) as Day[]

  function updateDay(weekday: number, patch: Partial<Day>) {
    setWeek((w) => w.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)))
  }

  function save() {
    startTransition(async () => {
      if (changedDays > 0) {
        const res = await updateBusinessHoursAction({
          days: week.map((d) => ({
            weekday: d.weekday,
            isClosed: d.isClosed,
            ...(d.isClosed ? {} : { openMin: d.openMin ?? 1080, closeMin: d.closeMin ?? 1440 }),
          })),
        })
        const failure = describeFailure(res)
        if (failure) {
          toast.show({ message: failure })
          return
        }
      }
      if (changedRules > 0) {
        const res = await updateSettingsAction(rules)
        const failure = describeFailure(res)
        if (failure) {
          toast.show({ message: failure })
          return
        }
      }
      toast.show({ message: S.settings.savedToast, icon: true })
    })
  }

  function addOverride() {
    startTransition(async () => {
      const res = await upsertHourOverrideAction({
        date: ovDate,
        isClosed: ovClosed,
        ...(ovClosed ? {} : { openMin: ovOpen, closeMin: ovClose }),
        reason: ovReason,
      })
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? (S.errors.generic as string) })
        return
      }
      setShowOv(false)
      setOvReason('')
      const n = res.data.warnings.bookingsOnDate
      toast.show({
        message: S.settings.savedToast,
        sub: n > 0 ? S.settings.overrideWarn(n) : undefined,
        durationMs: n > 0 ? 7000 : undefined,
      })
      window.location.reload()
    })
  }

  function removeOverride(date: string) {
    startTransition(async () => {
      const res = await deleteHourOverrideAction({ date })
      const failure = describeFailure(res)
      if (failure) toast.show({ message: failure })
      else window.location.reload()
    })
  }

  const leadOptions = [0, 30, 60, 90, 120, 180, 1440]
  const advanceOptions = [14, 30, 60, 90, 120, 180]
  const cancelOptions = [0, 60, 120, 180, 1440]
  const nowMs = useNowMinute()
  const nowMin = nowMs === null ? 18 * 60 : Math.floor(nowMinutes(today, new Date(nowMs)) / 5) * 5
  const earliest = formatMinutes(Math.min(1439, nowMin + rules.leadTimeMin))

  return (
    <>
      <h2 className="sec-h">
        {S.settings.weekHead}
        <span className="cap">{S.settings.weekCap}</span>
      </h2>
      <ul className="list wk-list">
        {ordered.map((d) => {
          const long = S.settings.weekdayLong[d.weekday] as string
          const orig = hours.week.find((w) => w.weekday === d.weekday)
          const changed =
            orig && (orig.isClosed !== d.isClosed || orig.openMin !== d.openMin || orig.closeMin !== d.closeMin)
          const invalid = !d.isClosed && (d.openMin ?? 0) >= (d.closeMin ?? 0)
          return (
            <li key={d.weekday} className={d.isClosed ? 'wk-off' : ''}>
              <span className="d" aria-hidden="true">
                {S.settings.weekdayShort[d.weekday]}
              </span>
              <label className="sw">
                <input
                  className="vh-input"
                  type="checkbox"
                  role="switch"
                  aria-checked={!d.isClosed}
                  aria-label={`${long} ${S.settings.open}`}
                  checked={!d.isClosed}
                  onChange={(e) =>
                    updateDay(d.weekday, {
                      isClosed: !e.target.checked,
                      openMin: d.openMin ?? 1080,
                      closeMin: d.closeMin ?? 1440,
                    })
                  }
                />
                <span className="track" aria-hidden="true" />
              </label>
              {d.isClosed ? (
                <span className="off-txt">{S.settings.closedDay}</span>
              ) : (
                <span className="times">
                  <span className="select">
                    <select
                      className="input"
                      aria-label={S.settings.startOf(long)}
                      value={d.openMin ?? 1080}
                      onChange={(e) => updateDay(d.weekday, { openMin: Number(e.target.value) })}
                    >
                      {OPEN_OPTIONS.slice(0, 48).map((m) => (
                        <option key={m} value={m}>
                          {toOption(m)}
                        </option>
                      ))}
                    </select>
                    <Icon name="chev-d" />
                  </span>
                  <span className="dash" aria-hidden="true">
                    –
                  </span>
                  <span className="select">
                    <select
                      className={`input ${changed ? 'is-changed' : ''}`}
                      aria-label={S.settings.endOf(long)}
                      aria-invalid={invalid ? true : undefined}
                      value={d.closeMin ?? 1440}
                      onChange={(e) => updateDay(d.weekday, { closeMin: Number(e.target.value) })}
                    >
                      {OPEN_OPTIONS.slice(1).map((m) => (
                        <option key={m} value={m}>
                          {toOption(m)}
                        </option>
                      ))}
                    </select>
                    <Icon name="chev-d" />
                  </span>
                </span>
              )}
              {invalid ? (
                <span className="chg">{S.settings.hoursInvalid}</span>
              ) : changed ? (
                <span className="chg">{S.settings.changed}</span>
              ) : null}
            </li>
          )
        })}
      </ul>

      <h2 className="sec-h">
        {S.settings.overridesHead}
        <span className="cap">{S.settings.overridesCap}</span>
      </h2>
      {hours.overrides.length > 0 ? (
        <ul className="list ov-list">
          {hours.overrides.map((o) => (
            <li key={o.date} className="row-link">
              <span className="grow">
                <b>
                  <span className="num">{formatDateJa(o.date).replace(/（.*$/, '')}</span>
                  {formatDateJa(o.date).replace(/^[^（]*/, '')}
                </b>{' '}
                {o.isClosed ? S.settings.overrideClosed : `${toOption(o.openMin ?? 0)}–${toOption(o.closeMin ?? 0)}`}
                <span className="cap" style={{ display: 'block' }}>
                  {o.reason ?? (o.isClosed ? S.settings.overrideClosed : S.settings.overrideHours)}
                </span>
              </span>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                disabled={pending}
                onClick={() => removeOverride(o.date)}
              >
                {S.settings.overrideDelete}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="help">{S.settings.overridesNone}</p>
      )}
      {showOv ? (
        <div className="card override-form">
          <div className="field">
            <label className="label" htmlFor="ov-date">
              {S.settings.overrideDate}
            </label>
            <input
              id="ov-date"
              className="input num"
              type="date"
              min={today}
              value={ovDate}
              onChange={(e) => setOvDate(e.target.value)}
            />
          </div>
          <fieldset className="field">
            <legend className="label">{S.settings.overrideKind}</legend>
            <div className="seg-row">
              <label>
                <input
                  className="vh-input"
                  type="radio"
                  name="ovk"
                  checked={ovClosed}
                  onChange={() => setOvClosed(true)}
                />
                <span>{S.settings.overrideClosed}</span>
              </label>
              <label>
                <input
                  className="vh-input"
                  type="radio"
                  name="ovk"
                  checked={!ovClosed}
                  onChange={() => setOvClosed(false)}
                />
                <span>{S.settings.overrideHours}</span>
              </label>
            </div>
          </fieldset>
          {!ovClosed ? (
            <div className="times">
              <span className="select">
                <select
                  className="input"
                  aria-label={S.blockForm.start}
                  value={ovOpen}
                  onChange={(e) => setOvOpen(Number(e.target.value))}
                >
                  {OPEN_OPTIONS.slice(0, 48).map((m) => (
                    <option key={m} value={m}>
                      {toOption(m)}
                    </option>
                  ))}
                </select>
                <Icon name="chev-d" />
              </span>
              <span className="dash" aria-hidden="true">
                –
              </span>
              <span className="select">
                <select
                  className="input"
                  aria-label={S.blockForm.end}
                  value={ovClose}
                  onChange={(e) => setOvClose(Number(e.target.value))}
                >
                  {OPEN_OPTIONS.slice(1).map((m) => (
                    <option key={m} value={m}>
                      {toOption(m)}
                    </option>
                  ))}
                </select>
                <Icon name="chev-d" />
              </span>
            </div>
          ) : null}
          <div className="field">
            <label className="label" htmlFor="ov-reason">
              {S.settings.overrideReason}
              <span className="req">{S.settings.overrideReasonHelp}</span>
            </label>
            <input
              id="ov-reason"
              className="input"
              type="text"
              maxLength={100}
              value={ovReason}
              onChange={(e) => setOvReason(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-block" type="button" disabled={pending} onClick={addOverride}>
            {S.settings.overrideSave}
          </button>
        </div>
      ) : (
        <button className="btn btn-secondary btn-block add-btn" type="button" onClick={() => setShowOv(true)}>
          <Icon name="plus" />
          {S.settings.addOverride}
        </button>
      )}

      <h2 className="sec-h">{S.settings.rulesHead}</h2>
      <div className="card rules">
        <fieldset className="field">
          <legend className="label">{S.settings.step}</legend>
          <div className="seg-row">
            {[15, 30, 60].map((m) => (
              <label key={m}>
                <input
                  className="vh-input"
                  type="radio"
                  name="step"
                  checked={rules.slotStepMin === m}
                  onChange={() => setRules((r) => ({ ...r, slotStepMin: m }))}
                />
                <span>{S.settings.minutes(m)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label className="label" htmlFor="lead">
            {S.settings.lead}
          </label>
          <span className="select">
            <select
              id="lead"
              className="input"
              value={rules.leadTimeMin}
              onChange={(e) => setRules((r) => ({ ...r, leadTimeMin: Number(e.target.value) }))}
            >
              {Array.from(new Set([...leadOptions, rules.leadTimeMin]))
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {S.settings.leadOption(m)}
                  </option>
                ))}
            </select>
            <Icon name="chev-d" />
          </span>
        </div>
        <div className="field">
          <label className="label" htmlFor="adv">
            {S.settings.advance}
          </label>
          <span className="select">
            <select
              id="adv"
              className="input"
              value={rules.maxAdvanceDays}
              onChange={(e) => setRules((r) => ({ ...r, maxAdvanceDays: Number(e.target.value) }))}
            >
              {Array.from(new Set([...advanceOptions, rules.maxAdvanceDays]))
                .sort((a, b) => a - b)
                .map((d) => (
                  <option key={d} value={d}>
                    {S.settings.advanceOption(d)}
                  </option>
                ))}
            </select>
            <Icon name="chev-d" />
          </span>
        </div>
        <div className="field">
          <label className="label" htmlFor="cxl">
            {S.settings.cancelDeadline}
          </label>
          <span className="select">
            <select
              id="cxl"
              className="input"
              value={rules.cancelDeadlineMin}
              onChange={(e) => setRules((r) => ({ ...r, cancelDeadlineMin: Number(e.target.value) }))}
            >
              {Array.from(new Set([...cancelOptions, rules.cancelDeadlineMin]))
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {S.settings.cancelOption(m)}
                  </option>
                ))}
            </select>
            <Icon name="chev-d" />
          </span>
          <p className="help">{S.settings.cancelHelp}</p>
        </div>
        <div className="preview sunken">
          <Icon name="clock" />
          <span>
            <b>{S.settings.preview}</b>
            {S.settings.previewBody(
              formatMinutes(nowMin),
              earliest,
              formatDateJa(addDays(today, rules.maxAdvanceDays)),
              rules.maxAdvanceDays,
            )}
          </span>
        </div>
        <div className="sw-row">
          <span className="t">
            <b>{S.settings.sameDay}</b>
          </span>
          <label className="sw">
            <input
              className="vh-input"
              type="checkbox"
              role="switch"
              aria-checked={rules.allowSameDay}
              aria-label={S.settings.sameDay}
              checked={rules.allowSameDay}
              onChange={(e) => setRules((r) => ({ ...r, allowSameDay: e.target.checked }))}
            />
            <span className="track" aria-hidden="true" />
          </label>
        </div>
        {/* Read-only: the cron schedule is fixed on Vercel Hobby (vercel.json, once a day). */}
        <div className="sw-row">
          <span className="t">
            <b>{S.settings.digestHour}</b>
            <span className="help">{S.settings.digestHourNote}</span>
          </span>
          <span>{S.settings.digestHourValue}</span>
        </div>
      </div>

      <div className="cta-bar above-tabs">
        <p className="cap">{S.settings.immediate}</p>
        <button
          className={`btn btn-primary btn-block ${changes === 0 ? 'is-off' : ''}`}
          type="button"
          aria-disabled={changes === 0 || pending}
          onClick={() => changes > 0 && !pending && save()}
        >
          {pending ? S.saving : S.settings.saveChanges(changes)}
        </button>
      </div>
    </>
  )
}
