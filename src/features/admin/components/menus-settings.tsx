'use client'

import { useState, useTransition } from 'react'
import { formatMinutes } from '@/domain/jst-format'
import { moveMenuAction, setMenuActiveAction, upsertMenuAction } from '../actions'
import type { AdminMenu } from '../queries'
import { errorText, S } from '../strings'
import { Icon } from './icon'
import { Sheet } from './sheet'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/*
 * S-A-09 メニュー (FR-A-08, AT-22): list with publish switches and up/down ordering, edit sheet
 * with the "last start" preview. Each save calls updateTag('menus') so the cached customer
 * menus refresh immediately; booking writes always re-read menus inside the transaction.
 */

type Form = {
  id?: string
  slug: string
  nameJa: string
  nameEn: string
  descriptionJa: string
  descriptionEn: string
  priceJpy: string
  priceStudentJpy: string
  durationMin: number
  bufferAfterMin: number
  isActive: boolean
}

const DURATIONS = Array.from({ length: 32 }, (_, i) => 15 + i * 15).filter((m) => m <= 480)
const BUFFERS = [0, 5, 10, 15, 20, 30, 45, 60]

const toForm = (m: AdminMenu): Form => ({
  id: m.id,
  slug: m.slug,
  nameJa: m.nameJa,
  nameEn: m.nameEn,
  descriptionJa: m.descriptionJa ?? '',
  descriptionEn: m.descriptionEn ?? '',
  priceJpy: String(m.priceJpy),
  priceStudentJpy: m.priceStudentJpy === null ? '' : String(m.priceStudentJpy),
  durationMin: m.durationMin,
  bufferAfterMin: m.bufferAfterMin,
  isActive: m.isActive,
})

const EMPTY: Form = {
  slug: '',
  nameJa: '',
  nameEn: '',
  descriptionJa: '',
  descriptionEn: '',
  priceJpy: '0',
  priceStudentJpy: '',
  durationMin: 60,
  bufferAfterMin: 0,
  isActive: false,
}

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

export function MenusSettings({ menus, typicalCloseMin }: { menus: AdminMenu[]; typicalCloseMin: number }) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<Form | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function run(fn: () => Promise<{ status: string }>, done?: string) {
    startTransition(async () => {
      const res = await fn()
      const failure = describeFailure(res as never)
      if (failure) toast.show({ message: failure })
      else if (done) toast.show({ message: done, icon: true })
    })
  }

  function save() {
    if (!form) return
    setErrors({})
    startTransition(async () => {
      const res = await upsertMenuAction({
        ...form,
        priceJpy: form.priceJpy.replace(/[,，\s]/g, ''),
        priceStudentJpy: form.priceStudentJpy.replace(/[,，\s]/g, ''),
      })
      if (res.status === 'invalid') {
        setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k, errorText(v[0])])))
        return
      }
      const failure = describeFailure(res)
      if (failure) {
        toast.show({ message: failure })
        return
      }
      setForm(null)
      toast.show({ message: S.settings.savedToast, icon: true })
    })
  }

  const field = (
    key: keyof Form,
    label: string,
    opts: { lang?: string; numeric?: boolean; prefix?: boolean; help?: string } = {},
  ) => {
    if (!form) return null
    const input = (
      <input
        id={`m-${key}`}
        className={`input ${opts.numeric ? 'num' : ''}`}
        type="text"
        inputMode={opts.numeric ? 'numeric' : undefined}
        lang={opts.lang}
        value={String(form[key] ?? '')}
        aria-invalid={errors[key] ? true : undefined}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    )
    return (
      <div className="field">
        <label className="label" htmlFor={`m-${key}`}>
          {label}
          {opts.help ? <span className="req">{opts.help}</span> : null}
        </label>
        {opts.prefix ? (
          <span className="prefix">
            <span aria-hidden="true">¥</span>
            {input}
          </span>
        ) : (
          input
        )}
        {errors[key] ? <p className="field-error">{errors[key]}</p> : null}
      </div>
    )
  }

  const lastStart = form ? typicalCloseMin - form.durationMin - form.bufferAfterMin : 0

  return (
    <>
      <div className="m-tools">
        <h2>
          {S.menus.head}
          <span className="cap" style={{ display: 'block', fontWeight: 500 }}>
            {S.menus.headCap}
          </span>
        </h2>
      </div>
      <ul className="list m-list">
        {menus.map((m, i) => (
          <li key={m.id} className={m.isActive ? '' : 'is-hidden'}>
            <span className="menu-move">
              <button
                className="icon-btn"
                type="button"
                aria-label={S.menus.up(m.nameJa)}
                disabled={i === 0 || pending}
                onClick={() => run(() => moveMenuAction({ menuId: m.id, direction: 'up' }))}
              >
                <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
                  <Icon name="chev-d" />
                </span>
              </button>
              <button
                className="icon-btn"
                type="button"
                aria-label={S.menus.down(m.nameJa)}
                disabled={i === menus.length - 1 || pending}
                onClick={() => run(() => moveMenuAction({ menuId: m.id, direction: 'down' }))}
              >
                <Icon name="chev-d" />
              </button>
            </span>
            <button className="m-main" type="button" style={{ textAlign: 'left' }} onClick={() => setForm(toForm(m))}>
              <span className="nm">
                {m.nameJa}
                {m.isActive ? null : <span className="chip chip-muted">{S.menus.hidden}</span>}
                <span className="en" lang="en">
                  {m.nameEn}
                </span>
              </span>
              <span className="m-meta">
                {m.priceJpy > 0 ? (
                  <>
                    <span>
                      {S.menus.general} <b>{yen(m.priceJpy)}</b>
                    </span>
                    <span>
                      {S.menus.student} <b>{yen(m.priceStudentJpy ?? m.priceJpy)}</b>
                    </span>
                  </>
                ) : (
                  <span className="na">{S.menus.priceUnset}</span>
                )}
                <span>
                  {S.menus.duration} <b>{m.durationMin}</b> 分
                </span>
                <span>
                  {S.menus.buffer} <b>{m.bufferAfterMin}</b> 分
                </span>
              </span>
            </button>
            <label className="sw m-sw">
              <input
                className="vh-input"
                type="checkbox"
                role="switch"
                aria-checked={m.isActive}
                aria-label={S.menus.publish(m.nameJa)}
                checked={m.isActive}
                disabled={pending}
                onChange={(e) =>
                  run(() => setMenuActiveAction({ menuId: m.id, isActive: e.target.checked }), S.settings.savedToast)
                }
              />
              <span className="track" aria-hidden="true" />
            </label>
          </li>
        ))}
      </ul>
      <button className="btn btn-secondary btn-block add-btn" type="button" onClick={() => setForm({ ...EMPTY })}>
        <Icon name="plus" />
        {S.menus.add}
      </button>
      <p className="tmp-note">
        <Icon name="info" />
        <span>{S.menus.note}</span>
      </p>

      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? S.menus.editTitle : S.menus.newTitle}
        className="edit"
      >
        {form ? (
          <div className="stack">
            {form.id ? null : field('slug', S.menus.slug, { lang: 'en' })}
            <div className="two">
              {field('nameJa', S.menus.nameJa)}
              {field('nameEn', S.menus.nameEn, { lang: 'en' })}
            </div>
            <div className="two">
              {field('priceJpy', S.menus.price, { numeric: true, prefix: true })}
              {field('priceStudentJpy', S.menus.studentPrice, {
                numeric: true,
                prefix: true,
                help: S.menus.studentPriceHelp,
              })}
            </div>
            <div className="two">
              <div className="field">
                <label className="label" htmlFor="m-dur">
                  {S.menus.durationLabel}
                </label>
                <span className="select">
                  <select
                    id="m-dur"
                    className="input"
                    value={form.durationMin}
                    onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
                  >
                    {Array.from(new Set([...DURATIONS, form.durationMin]))
                      .sort((a, b) => a - b)
                      .map((m) => (
                        <option key={m} value={m}>
                          {m} 分
                        </option>
                      ))}
                  </select>
                  <Icon name="chev-d" />
                </span>
              </div>
              <div className="field">
                <label className="label" htmlFor="m-buf">
                  {S.menus.bufferLabel}
                </label>
                <span className="select">
                  <select
                    id="m-buf"
                    className="input"
                    value={form.bufferAfterMin}
                    onChange={(e) => setForm({ ...form, bufferAfterMin: Number(e.target.value) })}
                  >
                    {Array.from(new Set([...BUFFERS, form.bufferAfterMin]))
                      .sort((a, b) => a - b)
                      .map((m) => (
                        <option key={m} value={m}>
                          {m} 分
                        </option>
                      ))}
                  </select>
                  <Icon name="chev-d" />
                </span>
              </div>
            </div>
            <p className="calc sunken" role="status">
              <Icon name="clock" />
              <span>
                {S.menus.lastStart(
                  typicalCloseMin === 1440 ? '24:00' : formatMinutes(typicalCloseMin),
                  formatMinutes(Math.max(0, lastStart)),
                  form.durationMin,
                  form.bufferAfterMin,
                )}
              </span>
            </p>
            <div className="sw-row">
              <span className="t">
                <b>{S.menus.publishLabel}</b>
                <span className="cap">{S.menus.publishHelp}</span>
              </span>
              <label className="sw">
                <input
                  className="vh-input"
                  type="checkbox"
                  role="switch"
                  aria-checked={form.isActive}
                  aria-label={S.menus.publishLabel}
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span className="track" aria-hidden="true" />
              </label>
            </div>
            <div className="btn-row">
              <button className="btn btn-secondary" type="button" onClick={() => setForm(null)}>
                {S.cancel}
              </button>
              <button className="btn btn-primary" type="button" disabled={pending} onClick={save}>
                {pending ? S.saving : S.save}
              </button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
