'use client'

import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toHiragana } from '@/domain/kana'
import { jstDate, monthOf } from '@/domain/time'
import { MonthCalendar, MonthCalendarSkeleton } from '@/features/availability/components/month-calendar'
import { TimeChips } from '@/features/availability/components/time-chips'
import type { MonthSlotsDTO } from '@/features/availability/queries'
import { InfoFields } from '@/features/booking/components/info-fields'
import { MenuPicker, type MenuPickerItem } from '@/features/booking/components/menu-picker'
import { yenText } from '@/features/booking/components/price'
import { type Draft, EMPTY_DRAFT, updateDraft, useDraft } from '@/features/booking/draft'
import type { BookingErrorKey } from '@/features/booking/messages'
import { allErrors, type InfoField, type InfoValues, infoFields, validateField } from '@/features/booking/validate'
import { formatDateLabel, formatTimeSpan } from '@/lib/i18n/display'
import { useRouter } from '@/lib/i18n/navigation'

type Step = 'menu' | 'time' | 'info'
const STEPS: Step[] = ['menu', 'time', 'info']
type Load = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: MonthSlotsDTO; at: number }
/** Re-read a month when the date step is reopened after this long (bookings move). */
const FRESH_MS = 60_000

const monthKey = (menu: string, month: string) => `${menu}|${month}`

function writeStep(step: Step, mode: 'push' | 'replace') {
  const url = new URL(window.location.href)
  url.searchParams.set('step', step)
  url.searchParams.delete('taken')
  url.searchParams.delete('menu')
  const state = { ...(window.history.state ?? {}), bookingStep: step }
  if (mode === 'push') window.history.pushState(state, '', url)
  else window.history.replaceState(state, '', url)
}

/**
 * The whole booking form on the top page (S-C-02/03/02b merged, 03_screen_specs v0.8):
 * ① menu → ② date & time → ③ customer details. Choosing in a step collapses it to a one-line
 * summary with "変更" and opens the next one; the only button is "この内容で予約する" at the end,
 * which leads to the separate review page (S-C-04). Each step is a history entry, so the
 * browser's back button returns to the previous step. The month's availability comes from
 * GET /api/availability in one request, so switching days is instant (ADR-0010).
 */
type Props = { menus: MenuPickerItem[]; leadTimeMin: number }

type Initial = {
  menuSlug: string
  startsAt: string
  values: InfoValues
  open: Step
  banner: 'taken' | 'deadline' | null
  /** The URL asked for a step (old links, review page "変更"): scroll to it once mounted. */
  focus: boolean
  /** JST today on the client ('' while prerendering: the clock is read only in the browser). */
  today: string
}

/** Selection to start from: the URL (?menu=, ?step=, ?taken=) first, then the session draft. */
function initialFrom(draft: Draft | null, menus: MenuPickerItem[]): Initial {
  const params = new URLSearchParams(window.location.search)
  const valid = (slug: string | null | undefined) => (slug && menus.some((m) => m.slug === slug) ? slug : '')
  const fromUrl = valid(params.get('menu'))
  const menuSlug = fromUrl || valid(draft?.menuSlug)
  const taken = params.get('taken')
  const keepTime = !!draft?.startsAt && draft.menuSlug === menuSlug && !taken
  const startsAt = keepTime ? (draft?.startsAt ?? '') : ''
  const d = draft ?? EMPTY_DRAFT
  const asked = params.get('step')
  let open: Step = 'menu'
  if (menuSlug && startsAt && asked !== 'menu' && asked !== 'time') open = 'info'
  else if (menuSlug && asked !== 'menu') open = 'time'
  return {
    menuSlug,
    startsAt,
    values: { name: d.name, nameKana: d.nameKana, occupation: d.occupation, phone: d.phone, note: d.note },
    open,
    banner: taken === '1' ? 'taken' : taken === 'deadline' ? 'deadline' : null,
    focus: !!(asked || taken || fromUrl),
    today: jstDate(new Date()),
  }
}

const SERVER_INITIAL: Initial = {
  menuSlug: '',
  startsAt: '',
  values: { name: '', nameKana: '', occupation: '', phone: '', note: '' },
  open: 'menu',
  banner: null,
  focus: false,
  today: '',
}

export function BookingSection(props: Props) {
  const draft = useDraft()
  // Server render and hydration use the empty selection; once the session draft is readable the
  // steps remount with it (no setState-in-effect, no hydration mismatch).
  if (draft === undefined) return <BookingSteps {...props} initial={SERVER_INITIAL} interactive={false} />
  return <ClientSteps {...props} draft={draft} />
}

function ClientSteps({ draft, ...props }: Props & { draft: Draft | null }) {
  // Read once: later draft writes come from these very steps.
  const [initial] = useState(() => initialFrom(draft, props.menus))
  return <BookingSteps {...props} initial={initial} interactive />
}

function BookingSteps({
  menus,
  leadTimeMin,
  initial,
  interactive,
}: Props & { initial: Initial; interactive: boolean }) {
  const t = useTranslations('flow')
  const ta = useTranslations('availability')
  const tm = useTranslations('menu')
  const tc = useTranslations('common')
  const locale = useLocale() as 'ja' | 'en'
  const router = useRouter()
  const [menuSlug, setMenuSlug] = useState(initial.menuSlug)
  const [startsAt, setStartsAt] = useState(initial.startsAt)
  const [values, setValues] = useState<InfoValues>(initial.values)
  const [errors, setErrors] = useState<Partial<Record<InfoField, BookingErrorKey>>>({})
  const [open, setOpen] = useState<Step>(initial.open)
  const [month, setMonth] = useState<string | null>(initial.startsAt ? monthOf(initial.startsAt.slice(0, 10)) : null)
  const [date, setDate] = useState<string | null>(initial.startsAt ? initial.startsAt.slice(0, 10) : null)
  const [banner, setBanner] = useState(initial.banner)
  const [months, setMonths] = useState<Record<string, Load>>({})
  const cache = useRef<Record<string, Load>>({})
  const headRefs = useRef<Partial<Record<Step, HTMLHeadingElement | null>>>({})
  const fieldRefs = useRef<Partial<Record<InfoField, HTMLElement | null>>>({})
  const pendingFocus = useRef<Step | null>(initial.focus ? initial.open : null)
  const ready = interactive

  const menu = menus.find((m) => m.slug === menuSlug)
  const today = initial.today
  const currentMonth = today ? monthOf(today) : ''

  const put = useCallback((key: string, value: Load) => {
    cache.current = { ...cache.current, [key]: value }
    setMonths(cache.current)
  }, [])

  const ensureMonth = useCallback(
    async (slug: string, m: string, refresh = false) => {
      const key = monthKey(slug, m)
      const hit = cache.current[key]
      const stale = refresh && hit?.status === 'ok' && Date.now() - hit.at > FRESH_MS
      if (hit && hit.status !== 'error' && !stale) return hit.status === 'ok' ? hit.data : null
      if (!hit || hit.status === 'error') put(key, { status: 'loading' })
      try {
        const res = await fetch(`/api/availability?${new URLSearchParams({ menu: slug, month: m })}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as MonthSlotsDTO
        put(key, { status: 'ok', data, at: Date.now() })
        return data
      } catch {
        put(key, { status: 'error' })
        return null
      }
    },
    [put],
  )

  // Once mounted on the client: sync the draft and URL with the starting point (`initial` is
  // fixed for the component's lifetime, so this runs once).
  useEffect(() => {
    if (!interactive) return
    if (initial.menuSlug) updateDraft({ menuSlug: initial.menuSlug, startsAt: initial.startsAt })
    if (initial.focus) writeStep(initial.open, 'replace')
  }, [interactive, initial])

  // Load the month shown in the date step; prefetch the next one so "次の月" is instant too.
  const shownMonth = month ?? currentMonth
  useEffect(() => {
    if (!ready || !menuSlug || open !== 'time' || !shownMonth) return
    let stop = false
    void ensureMonth(menuSlug, shownMonth, true).then((data) => {
      if (stop || !data) return
      if (date === null && data.month === monthOf(data.today)) setDate(data.today)
      if (data.nextMonth) void ensureMonth(menuSlug, data.nextMonth)
    })
    return () => {
      stop = true
    }
  }, [ready, menuSlug, open, shownMonth, date, ensureMonth])

  // Browser back / forward moves between steps.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = ((e.state as { bookingStep?: Step } | null)?.bookingStep ??
        new URL(window.location.href).searchParams.get('step')) as Step | null
      setOpen(s && STEPS.includes(s) ? s : 'menu')
      pendingFocus.current = s && STEPS.includes(s) ? s : 'menu'
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Bring the step that just opened into view and give it focus (screen readers announce it).
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after the open step renders
  useEffect(() => {
    const step = pendingFocus.current
    if (!step) return
    pendingFocus.current = null
    const head = headRefs.current[step]
    if (!head) return
    head.focus({ preventScroll: true })
    head.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open, ready])

  function go(step: Step) {
    setOpen(step)
    pendingFocus.current = step
    writeStep(step, 'push')
  }

  function chooseMenu(slug: string) {
    const changed = slug !== menuSlug
    setMenuSlug(slug)
    setBanner(null)
    if (changed) setStartsAt('')
    updateDraft({ menuSlug: slug, ...(changed ? { startsAt: '' } : {}) })
    go('time')
  }

  function chooseMonth(m: string) {
    setMonth(m)
    setDate(m === currentMonth ? today : null)
  }

  function chooseTime(s: string) {
    setStartsAt(s)
    setBanner(null)
    updateDraft({ menuSlug, startsAt: s })
    go('info')
  }

  function setField(field: InfoField, value: string) {
    const next = { ...values, [field]: value } as InfoValues
    setValues(next)
    updateDraft({ ...next, menuSlug, startsAt })
    if (errors[field] || field === 'occupation') {
      setErrors((e) => ({ ...e, [field]: validateField(field, next, locale) ?? undefined }))
    }
  }

  function blurField(field: InfoField) {
    let next = values
    if (field === 'nameKana') {
      const converted = toHiragana(values.nameKana)
      if (
        converted !== values.nameKana &&
        validateField('nameKana', { ...values, nameKana: converted }, locale) === null
      ) {
        next = { ...values, nameKana: converted }
        setValues(next)
        updateDraft({ ...next, menuSlug, startsAt })
      }
    }
    if (next[field] === '' && !errors[field]) return
    setErrors((e) => ({ ...e, [field]: validateField(field, next, locale) ?? undefined }))
  }

  function submit() {
    const errs = allErrors(values, locale)
    const first = infoFields(locale).find((f) => errs[f])
    if (first) {
      setErrors(errs)
      const el = fieldRefs.current[first]
      el?.focus({ preventScroll: true })
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    updateDraft({ ...values, menuSlug, startsAt })
    router.push('/book/confirm')
  }

  const load = menuSlug ? months[monthKey(menuSlug, shownMonth)] : undefined
  const data = load?.status === 'ok' ? load.data : null
  const day = data && date ? data.days.find((d) => d.date === date) : undefined
  const end = menu && startsAt ? new Date(new Date(startsAt).getTime() + menu.durationMin * 60_000) : null
  const timeSummary =
    startsAt && end
      ? `${formatDateLabel(startsAt.slice(0, 10), locale)} ${formatTimeSpan(new Date(startsAt), end, locale)}`
      : ''

  // "次に空いている日へ": the next open day after the selection, in this month or the (prefetched) next.
  let nextOpen: { month: string; date: string } | null = null
  if (data && date && (day?.slots.length ?? 0) === 0) {
    const later = data.days.find((d) => d.date > date && d.slots.length > 0)
    if (later) nextOpen = { month: data.month, date: later.date }
    else if (data.nextMonth) {
      const nl = months[monthKey(menuSlug, data.nextMonth)]
      const first = nl?.status === 'ok' ? nl.data.days.find((d) => d.slots.length > 0) : undefined
      if (first && data.nextMonth) nextOpen = { month: data.nextMonth, date: first.date }
    }
  }

  const stepTitle: Record<Step, string> = { menu: t('stepMenu'), time: t('stepTime'), info: t('stepInfo') }
  const reached = (s: Step) => s === 'menu' || (s === 'time' ? !!menuSlug : !!menuSlug && !!startsAt)
  const summaryOf: Record<Step, ReactNode> = {
    menu: menu ? (
      <>
        <b>{menu.name[locale]}</b> <span className="sub">{tm('duration', { minutes: menu.durationMin })}</span>{' '}
        <span className="sub num">{yenText(menu.priceJpy)}</span>
      </>
    ) : null,
    time: timeSummary ? <b className="num">{timeSummary}</b> : null,
    info: null,
  }

  function renderBody(step: Step) {
    if (step === 'menu') {
      return <MenuPicker menus={menus} selected={menuSlug} onSelect={chooseMenu} labelledBy="bstep-menu" />
    }
    if (step === 'time') {
      return (
        <div className="btime">
          {banner ? (
            <div className="alert" role="alert">
              <h3>
                <Icon name="alert" />
                {banner === 'taken' ? ta('takenTitle') : ta('unavailableTitle')}
              </h3>
              <p>{banner === 'taken' ? ta('takenBody') : ta('unavailableBody')}</p>
            </div>
          ) : null}
          {locale === 'en' ? <p className="jst">{ta('jstNote')}</p> : null}
          {!load || load.status === 'loading' ? (
            <MonthCalendarSkeleton label={ta('loading')} />
          ) : load.status === 'error' ? (
            <div className="load-err" role="alert">
              <p>{t('loadError')}</p>
              <Button variant="secondary" size="sm" onClick={() => void ensureMonth(menuSlug, shownMonth)}>
                {t('retry')}
              </Button>
            </div>
          ) : data ? (
            <>
              <MonthCalendar
                month={data.month}
                days={data.days}
                prevMonth={data.prevMonth}
                nextMonth={data.nextMonth}
                today={data.today}
                selectedDate={date}
                onSelectDate={setDate}
                onMonth={chooseMonth}
              />
              <p className="bnote">
                <Icon name="clock" />
                {ta('leadTime', { minutes: leadTimeMin })}
              </p>
              {date ? (
                <>
                  <h3 className="slots-h" id="slots-h">
                    {ta('selectedDate', { date: formatDateLabel(date, locale) })}
                  </h3>
                  {day && day.slots.length > 0 && menu ? (
                    <TimeChips
                      slots={day.slots}
                      durationMin={menu.durationMin}
                      selected={startsAt}
                      onSelect={chooseTime}
                      labelledBy="slots-h"
                    />
                  ) : (
                    <div className="empty-day">
                      <p>{ta('noSlots')}</p>
                      {nextOpen ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          trailingIcon="arrowRight"
                          onClick={() => {
                            if (!nextOpen) return
                            setMonth(nextOpen.month)
                            setDate(nextOpen.date)
                          }}
                        >
                          {ta('nextAvailable')}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                <p className="slots-h muted">
                  {data.days.some((d) => d.slots.length > 0) ? ta('pickDay') : ta('noSlotsMonth')}
                </p>
              )}
            </>
          ) : null}
        </div>
      )
    }
    return (
      <InfoFields
        values={values}
        errors={errors}
        onChange={setField}
        onBlur={blurField}
        fieldRef={(f, el) => {
          fieldRefs.current[f] = el
        }}
      />
    )
  }

  const showCta = ready && open === 'info' && !!menu && !!startsAt
  return (
    <section className="sec book" id="book" aria-labelledby="book-h">
      <div className="sec-head">
        <p className="caps" lang="en">
          {t('caps')}
        </p>
        <h2 id="book-h">{t('heading')}</h2>
      </div>
      <ol className="bsteps">
        {STEPS.map((step, i) => {
          const isOpen = ready ? open === step : step === 'menu'
          const done = !isOpen && reached(step) && summaryOf[step] !== null && step !== 'info'
          return (
            <li key={step} className={isOpen ? 'bstep open' : done ? 'bstep done' : 'bstep'}>
              <div className="bstep-head">
                <span className="no" aria-hidden="true">
                  {done ? <Icon name="check" /> : i + 1}
                </span>
                <h3
                  id={`bstep-${step}`}
                  tabIndex={-1}
                  ref={(el) => {
                    headRefs.current[step] = el
                  }}
                >
                  {stepTitle[step]}
                </h3>
                {done ? (
                  <>
                    <p className="bsum">{summaryOf[step]}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('changeAria', { step: stepTitle[step] })}
                      onClick={() => go(step)}
                    >
                      {tc('change')}
                    </Button>
                  </>
                ) : null}
              </div>
              {isOpen ? <div className="bstep-body">{renderBody(step)}</div> : null}
            </li>
          )
        })}
      </ol>
      {showCta ? (
        <div className="sticky-cta paper">
          <div className="in">
            <p className="sum">
              <b>{menu?.name[locale]}</b> ／ <span className="num">{timeSummary}</span>
            </p>
            <Button variant="primary" block trailingIcon="arrowRight" onClick={submit}>
              {t('cta')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
