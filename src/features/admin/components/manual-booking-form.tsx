'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { formatDateJa } from '@/domain/jst-format'
import { createManualBookingAction } from '../actions'
import type { AdminMenu, CustomerSuggestion } from '../queries'
import { MANUAL_SOURCES } from '../schema'
import { errorText, S } from '../strings'
import type { OverlapDTO } from '../types'
import { useIsClient } from './client-hooks'
import { Icon } from './icon'
import { Sheet } from './sheet'
import { hhmm, isoAt, nowMinutes } from './time-utils'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/*
 * S-A-05 手動予約 (FR-A-05, DES-03 §7, OI-11): customer suggestion by kana / phone (WAI-ARIA
 * combobox), overlap pre-check (300 ms debounce) and a server re-check under the lock. While
 * an overlap exists the only action is 「時間を変更」 — there is no "save anyway". The draft is
 * kept in sessionStorage so an iOS background reload does not lose it (AT-17).
 */

const DRAFT_KEY = 'bb.draft.manual'
type Source = (typeof MANUAL_SOURCES)[number]

type Draft = {
  name: string
  nameKana: string
  phone: string
  customerId: string | null
  customerLabel: string | null
  menuId: string
  date: string
  start: string
  source: Source
  ownerNote: string
}

type Saved = { bookingId: string; confirmUrl: string; warnings: string[]; draft: Draft }

const START_OPTIONS = Array.from({ length: (24 - 6) * 4 }, (_, i) => hhmm(6 * 60 + i * 15))
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

type FormProps = { menus: AdminMenu[]; initialDate: string; initialStart: string | null }

/** Rendered on the client only, so the sessionStorage draft can seed the initial state. */
export function ManualBookingForm(props: FormProps) {
  const isClient = useIsClient()
  return isClient ? <ManualBookingFormInner {...props} /> : <p className="wrap form">{S.loading}</p>
}

function readDraft(initialStart: string | null): Partial<Draft> {
  if (initialStart) return {}
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Partial<Draft>) : {}
  } catch {
    return {}
  }
}

function ManualBookingFormInner({ menus, initialDate, initialStart }: FormProps) {
  const router = useRouter()
  const toast = useToast()
  const defaultMenu = menus.find((m) => m.isActive) ?? menus[0]
  const [draft, setDraft] = useState<Draft>(() => ({
    name: '',
    nameKana: '',
    phone: '',
    customerId: null,
    customerLabel: null,
    menuId: defaultMenu?.id ?? '',
    date: initialDate,
    start: initialStart ?? '',
    source: 'phone',
    ownerNote: '',
    ...readDraft(initialStart),
  }))
  const [fetchedSuggestions, setSuggestions] = useState<CustomerSuggestion[]>([])
  const [comboOpen, setComboOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [fetchedOverlaps, setOverlaps] = useState<OverlapDTO[]>([])
  const [fetchedOutside, setOutsideHours] = useState(false)
  const [freeStarts, setFreeStarts] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [linkLocale, setLinkLocale] = useState<'ja' | 'en'>('ja')
  const [pending, startTransition] = useTransition()
  const startRef = useRef<HTMLSelectElement>(null)

  const menu = useMemo(() => menus.find((m) => m.id === draft.menuId), [menus, draft.menuId])
  const set = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value })),
    [],
  )

  // Persist the draft (sessionStorage survives the iOS background reload).
  useEffect(() => {
    if (saved) return
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {}
  }, [draft, saved])

  // Customer suggestions (name / kana / phone), 250 ms debounce.
  const query = draft.customerId ? '' : draft.phone.replace(/\D/g, '').length >= 10 ? draft.phone : draft.name
  const suggestions = query.trim().length >= 2 ? fetchedSuggestions : []
  useEffect(() => {
    if (query.trim().length < 2) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/admin/customers/suggest?q=${encodeURIComponent(query.trim())}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items: CustomerSuggestion[] }) => {
          setSuggestions(d.items)
          setActive(0)
        })
        .catch(() => {})
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  // Free starts for the chosen day + menu.
  useEffect(() => {
    if (!draft.menuId || !draft.date) return
    const ctrl = new AbortController()
    fetch(`/api/admin/free-starts?date=${draft.date}&menuId=${draft.menuId}`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { starts: [] }))
      .then((d: { starts: string[] }) =>
        setFreeStarts(d.starts.map((iso) => hhmm(nowMinutes(draft.date, new Date(iso))))),
      )
      .catch(() => {})
    return () => ctrl.abort()
  }, [draft.menuId, draft.date])

  // Overlap pre-check (DES-03 §7.3): 300 ms debounce on date / start / menu.
  const total = menu ? menu.durationMin + menu.bufferAfterMin : 0
  const checkable = Boolean(draft.start && menu)
  const overlaps = checkable ? fetchedOverlaps : []
  const outsideHours = checkable && fetchedOutside
  useEffect(() => {
    if (!draft.start || !menu) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      const s = toMin(draft.start)
      const qs = new URLSearchParams({ start: isoAt(draft.date, s), end: isoAt(draft.date, s + total) })
      fetch(`/api/admin/overlaps?${qs}`, { signal: ctrl.signal, cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { overlaps: [], outsideHours: false }))
        .then((d: { overlaps: OverlapDTO[]; outsideHours: boolean }) => {
          setOverlaps(d.overlaps)
          setOutsideHours(d.outsideHours)
        })
        .catch(() => {})
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [draft.date, draft.start, menu, total])

  const bookingOverlaps = overlaps.filter((o) => o.kind === 'booking')
  const blockOverlap = overlaps.some((o) => o.kind === 'block')
  const hasOverlap = bookingOverlaps.length > 0
  const canSave = draft.name.trim() !== '' && draft.start !== '' && Boolean(menu)
  const near = useMemo(() => {
    if (!draft.start) return freeStarts.slice(0, 3)
    const s = toMin(draft.start)
    return [...freeStarts]
      .sort((a, b) => Math.abs(toMin(a) - s) - Math.abs(toMin(b) - s))
      .slice(0, 3)
      .sort()
  }, [freeStarts, draft.start])

  function pick(c: CustomerSuggestion) {
    setDraft((d) => ({
      ...d,
      customerId: c.id,
      customerLabel: `${c.name ?? ''}${c.nameKana ? `（${c.nameKana}）` : ''}`,
      name: c.name ?? d.name,
      nameKana: c.nameKana ?? '',
    }))
    setComboOpen(false)
  }

  function submit() {
    if (hasOverlap) {
      startRef.current?.focus()
      return
    }
    if (!canSave || !menu) return
    setFieldErrors({})
    setFormError(null)
    startTransition(async () => {
      const res = await createManualBookingAction({
        customerId: draft.customerId ?? '',
        name: draft.name,
        nameKana: draft.customerId ? '' : draft.nameKana,
        phone: draft.phone,
        menuId: draft.menuId,
        startsAt: isoAt(draft.date, toMin(draft.start)),
        source: draft.source,
        ownerNote: draft.ownerNote,
        linkLocale: 'ja',
      })
      if (res.status === 'ok') {
        try {
          sessionStorage.removeItem(DRAFT_KEY)
        } catch {}
        setSaved({ ...res.data, draft })
        return
      }
      if (res.status === 'conflict' && 'overlaps' in res) {
        setOverlaps(res.overlaps)
        startRef.current?.focus()
        return
      }
      if (res.status === 'invalid') {
        setFieldErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k, errorText(v[0])])))
        return
      }
      setFormError(describeFailure(res) ?? S.manual.saveFailed)
    })
  }

  const url = saved ? saved.confirmUrl.replace(/\/(ja|en)\/book\/done\//, `/${linkLocale}/book/done/`) : ''
  const savedMenu = saved ? menus.find((m) => m.id === saved.draft.menuId) : undefined
  const dmText = saved
    ? linkLocale === 'ja'
      ? S.manual.dmJa(
          (saved.draft.name.split(/\s|　/)[0] ?? saved.draft.name).trim(),
          formatDateJa(saved.draft.date),
          saved.draft.start,
          savedMenu?.nameJa ?? '',
          url,
        )
      : S.manual.dmEn(saved.draft.date, saved.draft.start, url)
    : ''

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.show({ message, placement: 'top', icon: true })
    } catch {
      toast.show({ message: S.detail.copyFailed, placement: 'top' })
    }
  }

  const endLabel = draft.start && menu ? hhmm(toMin(draft.start) + menu.durationMin) : null

  return (
    <>
      <header className="ah paper">
        <Link className="icon-btn" href={`/admin?date=${draft.date}`} aria-label={S.manual.backLabel}>
          <Icon name="back" />
        </Link>
        <h1>{S.manual.title}</h1>
      </header>
      <main className="wrap form has-cta v2-form">
        <h2 className="v2-sec-h">{S.manual.secWhen}</h2>
        <div className="field">
          <label className="label" htmlFor="menu">
            {S.manual.menu}
            <span className="req">{S.required}</span>
          </label>
          <span className="select">
            <select id="menu" className="input" value={draft.menuId} onChange={(e) => set('menuId', e.target.value)}>
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {S.manual.menuOption(m.nameJa, m.durationMin, m.priceJpy, m.isActive)}
                </option>
              ))}
            </select>
            <Icon name="chev-d" />
          </span>
        </div>

        <div className="when-row">
          <div className="field">
            <label className="label" htmlFor="date">
              {S.manual.date}
              <span className="req">{S.required}</span>
            </label>
            <input
              id="date"
              className="input num"
              type="date"
              value={draft.date}
              onChange={(e) => e.target.value && set('date', e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="start">
              {S.manual.start}
              <span className="req">{S.manual.startHelp}</span>
            </label>
            <span className="select">
              <select
                ref={startRef}
                id="start"
                className={`input num ${draft.start ? '' : 'is-empty'}`}
                value={draft.start}
                aria-invalid={hasOverlap ? true : undefined}
                aria-describedby={hasOverlap ? 'ov' : undefined}
                onChange={(e) => set('start', e.target.value)}
              >
                <option value="">--:--</option>
                {START_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Icon name="chev-d" />
            </span>
          </div>
        </div>
        {endLabel && menu ? (
          <p className="help end-note">
            {S.manual.endNote(endLabel, menu.nameJa, menu.durationMin, menu.bufferAfterMin)}
          </p>
        ) : null}
        {outsideHours && !hasOverlap ? (
          <p className="warn-note" role="status">
            <Icon name="alert" />
            {S.manual.outsideHours}
          </p>
        ) : null}
        {blockOverlap && !hasOverlap ? (
          <p className="warn-note" role="status">
            <Icon name="alert" />
            {S.manual.blockWarn}
          </p>
        ) : null}

        {hasOverlap ? (
          <div className="alert" role="alert" id="ov">
            <p className="alert-ttl">
              <Icon name="alert" />
              {S.manual.overlapTitle}
            </p>
            {bookingOverlaps.map((o) => (
              <p key={o.id}>
                <span className="num">
                  {hhmm(nowMinutes(draft.date, new Date(o.start)))}–{hhmm(nowMinutes(draft.date, new Date(o.end)))}
                </span>
                {S.manual.overlapMid}
                <b>{o.label}</b>
                {S.manual.overlapTail}
              </p>
            ))}
            {near.length > 0 ? (
              <>
                <p className="cap" id="near-h">
                  {S.manual.nearFree}
                </p>
                <fieldset className="chips" aria-labelledby="near-h">
                  {near.map((t) => (
                    <button key={t} className="time-chip" type="button" onClick={() => set('start', t)}>
                      {t}
                    </button>
                  ))}
                </fieldset>
              </>
            ) : null}
          </div>
        ) : menu ? (
          <div>
            <p className="free-cap" id="free-h">
              {S.manual.freeTitle(formatDateJa(draft.date))}
              <small>{S.manual.freeHelp(menu.nameJa, menu.durationMin, menu.bufferAfterMin)}</small>
            </p>
            {freeStarts.length > 0 ? (
              <fieldset className="chips" aria-labelledby="free-h">
                {freeStarts.slice(0, 12).map((t) => (
                  <button key={t} className="time-chip" type="button" onClick={() => set('start', t)}>
                    {t}
                  </button>
                ))}
              </fieldset>
            ) : (
              <p className="help">{S.manual.freeNone}</p>
            )}
          </div>
        ) : null}

        <h2 className="v2-sec-h">{S.manual.secWho}</h2>
        <div className="field combo">
          <label className="label" htmlFor="name">
            {S.manual.name}
            <span className="req">{draft.customerId ? S.manual.existingCustomer : S.manual.nameHelp}</span>
            {!draft.customerId && draft.name.trim() !== '' && suggestions.length === 0 ? (
              <span className="chip">{S.manual.newCustomer}</span>
            ) : null}
          </label>
          <input
            id="name"
            className="input"
            type="text"
            role="combobox"
            aria-expanded={comboOpen && suggestions.length > 0}
            aria-controls="sug"
            aria-autocomplete="list"
            aria-activedescendant={comboOpen && suggestions.length > 0 ? `sug-${active}` : undefined}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? 'name-err' : undefined}
            autoComplete="off"
            maxLength={50}
            value={draft.name}
            readOnly={Boolean(draft.customerId)}
            onFocus={() => setComboOpen(true)}
            onBlur={() => setTimeout(() => setComboOpen(false), 150)}
            onChange={(e) => {
              set('name', e.target.value)
              setComboOpen(true)
            }}
            onKeyDown={(e) => {
              if (!comboOpen || suggestions.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, suggestions.length))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const c = suggestions[active]
                if (c) pick(c)
                else setComboOpen(false)
              } else if (e.key === 'Escape') setComboOpen(false)
            }}
          />
          {fieldErrors.name ? (
            <p className="field-error" id="name-err">
              {fieldErrors.name}
            </p>
          ) : null}
          {draft.customerId ? (
            <button
              className="btn btn-ghost"
              type="button"
              style={{ justifySelf: 'start' }}
              onClick={() => setDraft((d) => ({ ...d, customerId: null, customerLabel: null }))}
            >
              {S.manual.clearCustomer}
            </button>
          ) : null}
          {comboOpen && suggestions.length > 0 && !draft.customerId ? (
            <div className="sug" id="sug" role="listbox" aria-label={S.manual.suggestLabel}>
              {suggestions.map((c, i) => (
                <div
                  key={c.id}
                  tabIndex={-1}
                  id={`sug-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                  onKeyDown={() => {}}
                >
                  <span className="grow">
                    <b>{c.name ?? '—'}</b>
                    {c.nameKana ? `（${c.nameKana}）` : ''}
                    <span className="cap">
                      {S.manual.suggestMeta(
                        c.phoneLast4,
                        c.visitCount,
                        c.lastVisitAt ? c.lastVisitAt.slice(5, 10).replace('-', '/').replace(/^0/, '') : null,
                      )}
                      {c.restriction === 'dm_only' ? (
                        <>
                          ・<span className="pill">{S.manual.dmOnly}</span>
                        </>
                      ) : c.restriction === 'blocked' ? (
                        <>
                          ・<span className="pill">{S.manual.blocked}</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <Icon name="chev-r" />
                </div>
              ))}
              <div
                tabIndex={-1}
                id={`sug-${suggestions.length}`}
                role="option"
                aria-selected={active === suggestions.length}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setComboOpen(false)}
                onKeyDown={() => {}}
              >
                <span className="grow new">
                  <Icon name="userplus" /> {S.manual.suggestNew(draft.name)}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {!draft.customerId ? (
          <div className="field">
            <label className="label" htmlFor="kana">
              {S.manual.kana}
              <span className="req">{S.optional}</span>
            </label>
            <input
              id="kana"
              className="input"
              type="text"
              autoComplete="off"
              maxLength={50}
              value={draft.nameKana}
              aria-invalid={fieldErrors.nameKana ? true : undefined}
              onChange={(e) => set('nameKana', e.target.value)}
            />
            {fieldErrors.nameKana ? <p className="field-error">{fieldErrors.nameKana}</p> : null}
          </div>
        ) : null}

        <div className="field">
          <label className="label" htmlFor="tel">
            {S.manual.phone}
            <span className="req">{S.optional}</span>
          </label>
          <input
            id="tel"
            className="input num"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="090-1234-5678"
            aria-describedby="tel-h"
            aria-invalid={fieldErrors.phone ? true : undefined}
            value={draft.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
          <p className="help" id="tel-h">
            {S.manual.phoneHelp}
          </p>
          {fieldErrors.phone ? <p className="field-error">{fieldErrors.phone}</p> : null}
        </div>

        <h2 className="v2-sec-h">{S.manual.secOther}</h2>
        <fieldset className="field">
          <legend className="label">
            {S.manual.source}
            <span className="req">{S.required}</span>
          </legend>
          <div className="seg-row">
            {MANUAL_SOURCES.map((src) => (
              <label key={src}>
                <input
                  className="vh-input"
                  type="radio"
                  name="src"
                  value={src}
                  checked={draft.source === src}
                  onChange={() => set('source', src)}
                />
                <span>{S.source[src]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="label" htmlFor="memo">
            {S.manual.memo}
            <span className="req">{S.manual.memoHelp}</span>
          </label>
          <textarea
            id="memo"
            className="input"
            rows={2}
            maxLength={500}
            placeholder={S.manual.memoPlaceholder}
            value={draft.ownerNote}
            onChange={(e) => set('ownerNote', e.target.value)}
          />
        </div>
        {formError ? (
          <p className="field-error" role="alert">
            {formError}
          </p>
        ) : null}
      </main>

      <div className="cta-bar">
        {hasOverlap ? <p className="cap">{S.manual.cannotSaveOverlap}</p> : null}
        <button
          className={`btn btn-primary btn-block ${!hasOverlap && !canSave ? 'is-off' : ''}`}
          type="button"
          aria-disabled={!hasOverlap && (!canSave || pending)}
          aria-describedby={!hasOverlap && !canSave ? 'save-h' : undefined}
          aria-busy={pending}
          onClick={submit}
        >
          {hasOverlap ? S.manual.changeTime : pending ? S.saving : S.save}
        </button>
        {!hasOverlap && !canSave ? (
          <p className="vh" id="save-h">
            {S.manual.saveDisabledWhy}
          </p>
        ) : null}
      </div>

      <Sheet
        open={saved !== null}
        onClose={() => router.push(`/admin?date=${saved?.draft.date ?? draft.date}`)}
        title={S.manual.savedTitle}
        titleIcon={<Icon name="check" />}
        className="saved"
        hideClose
      >
        {saved ? (
          <>
            <p className="sum">
              <b>
                {formatDateJa(saved.draft.date)}{' '}
                <span className="num">
                  {saved.draft.start}–{savedMenu ? hhmm(toMin(saved.draft.start) + savedMenu.durationMin) : ''}
                </span>
              </b>{' '}
              ・ {saved.draft.name}様 ・ {savedMenu?.nameJa} ・ {S.source[saved.draft.source]}
            </p>
            <div className="stack">
              {saved.warnings.includes('outside_hours') ? <p className="warn-note">{S.manual.outsideHours}</p> : null}
              {saved.warnings.includes('block_overlap') ? <p className="warn-note">{S.manual.blockWarn}</p> : null}
              <Link className="btn btn-primary btn-block" href={`/admin?date=${saved.draft.date}`}>
                {S.manual.closeToToday}
              </Link>
              <details className="v2-more">
                <summary>{S.manual.sendToCustomer}</summary>
                <div className="stack">
                  <fieldset className="field">
                    <legend className="label">{S.manual.urlLocale}</legend>
                    <div className="seg-row">
                      <label>
                        <input
                          className="vh-input"
                          type="radio"
                          name="loc"
                          checked={linkLocale === 'ja'}
                          onChange={() => setLinkLocale('ja')}
                        />
                        <span>日本語</span>
                      </label>
                      <label>
                        <input
                          className="vh-input"
                          type="radio"
                          name="loc"
                          checked={linkLocale === 'en'}
                          onChange={() => setLinkLocale('en')}
                        />
                        <span lang="en">English</span>
                      </label>
                    </div>
                  </fieldset>
                  <input className="urlbox" readOnly value={url} aria-label={S.manual.urlLabel} />
                  <button
                    className="btn btn-secondary btn-block"
                    type="button"
                    onClick={() => copy(url, S.manual.urlCopied)}
                  >
                    <Icon name="copy" />
                    {S.manual.copyUrl}
                  </button>
                  <button
                    className="btn btn-secondary btn-block"
                    type="button"
                    onClick={() => copy(dmText, S.manual.dmCopied)}
                  >
                    <Icon name="copy" />
                    {S.manual.copyDm}
                  </button>
                  <a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer">
                    {S.detail.urlOpen}
                  </a>
                  <p className="cap dm-cap">{S.manual.dmCaption}</p>
                  <p className="dm" style={{ whiteSpace: 'pre-line' }}>
                    {dmText}
                  </p>
                </div>
              </details>
              <Link className="btn btn-ghost" href={`/admin/bookings/${saved.bookingId}`}>
                {S.manual.openDetail}
              </Link>
            </div>
          </>
        ) : null}
      </Sheet>
    </>
  )
}
