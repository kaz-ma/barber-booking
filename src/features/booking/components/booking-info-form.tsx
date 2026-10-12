'use client'

import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FieldWrapper } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { RadioGroup } from '@/components/ui/radio-group'
import { TextArea, TextInput } from '@/components/ui/text-input'
import { toHiragana } from '@/domain/kana'
import { useRouter } from '@/lib/i18n/navigation'
import { type Draft, EMPTY_DRAFT, updateDraft, useDraft } from '../draft'
import type { BookingErrorKey } from '../messages'
import {
  firstIncompleteStage,
  type InfoField,
  type InfoStage,
  type InfoValues,
  isStageComplete,
  STAGES,
  stageErrors,
  validateField,
} from '../validate'
import { SelectionSummary } from './selection-summary'
import type { BookingMenu } from './types'

type HistoryState = Record<string, unknown> & { bookingStep?: InfoStage }

/** history.pushState / replaceState with ?step= (Next.js keeps useSearchParams in sync). */
function writeStep(stage: InfoStage, mode: 'push' | 'replace') {
  const url = new URL(window.location.href)
  url.search = `?step=${stage}`
  const state: HistoryState = { ...(window.history.state ?? {}), bookingStep: stage }
  if (mode === 'push') window.history.pushState(state, '', url)
  else window.history.replaceState(state, '', url)
}

/**
 * S-C-02b ③ お客様情報 (FR-C-01, 03_screen_specs §1.4). One page, staged disclosure:
 * name(+furigana on /ja) → occupation → phone (+ optional note). Completed stages collapse to a
 * one-line summary with "変更"; the next stage opens on completion (occupation advances on
 * selection). Each stage is a history entry (pushState + ?step=), so browser back re-opens the
 * previous stage with every value kept (React state + sessionStorage draft). Errors appear on
 * blur and on "次へ", with the exact GOV.UK-style copy from booking.errors.
 */
export function BookingInfoForm({ menus }: { menus: BookingMenu[] }) {
  const draft = useDraft()
  const params = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const qMenu = params.get('menu') ?? ''
  const qStartsAt = params.get('startsAt') ?? ''
  const menuSlug = qMenu || draft?.menuSlug || ''
  const startsAt = qStartsAt || draft?.startsAt || ''
  const menu = menus.find((m) => m.slug === menuSlug)
  const returnToConfirm = params.get('return') === 'confirm'

  // Adopt the selection from the time step into the draft, then route if something is missing.
  useEffect(() => {
    if (draft === undefined) return
    if (!menu) {
      router.replace('/book')
      return
    }
    if (!startsAt) {
      router.replace({ pathname: '/book/time', query: { menu: menu.slug } })
      return
    }
    if (qMenu || qStartsAt) {
      const next = updateDraft({ menuSlug: menu.slug, startsAt })
      // Coming back from "日時を変更" on the review step with everything filled in: go straight back.
      if (returnToConfirm && firstIncompleteStage(next, locale) === null) {
        router.replace('/book/confirm')
      }
    }
  }, [draft, menu, startsAt, qMenu, qStartsAt, returnToConfirm, router, locale])

  // Wait for the client snapshot so a restored draft becomes the initial state.
  if (draft === undefined || !menu || !startsAt) return <div className="min-h-96" aria-hidden="true" />
  if (returnToConfirm && (qMenu || qStartsAt)) return <div className="min-h-96" aria-hidden="true" />
  return <InfoStages menu={menu} startsAt={startsAt} initial={draft ?? EMPTY_DRAFT} />
}

function InfoStages({ menu, startsAt, initial }: { menu: BookingMenu; startsAt: string; initial: Draft }) {
  const t = useTranslations('booking')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const [values, setValues] = useState<InfoValues>({
    name: initial.name,
    nameKana: initial.nameKana,
    occupation: initial.occupation,
    phone: initial.phone,
    note: initial.note,
  })
  const [errors, setErrors] = useState<Partial<Record<InfoField, BookingErrorKey>>>({})
  const [noteOpen, setNoteOpen] = useState(initial.note !== '' || params.get('note') === '1')
  const headingRefs = useRef<Partial<Record<InfoStage, HTMLHeadingElement | null>>>({})
  const fieldRefs = useRef<Partial<Record<InfoField, HTMLElement | null>>>({})

  // Current stage = the history entry's stage (pushState + ?step=), but never beyond the first
  // stage still missing input. Held in state and synced from popstate (browser back/forward).
  const [requested, setRequested] = useState<InfoStage>(
    () => STAGES.find((s) => s === params.get('step')) ?? firstIncompleteStage(values, locale) ?? 'phone',
  )
  const firstIncomplete = firstIncompleteStage(values, locale)
  const cap = firstIncomplete ? STAGES.indexOf(firstIncomplete) : STAGES.length - 1
  const current: InfoStage = STAGES[Math.min(STAGES.indexOf(requested), cap)] ?? 'name'
  const currentIdx = STAGES.indexOf(current)

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const fromState = (e.state as HistoryState | null)?.bookingStep
      const fromUrl = new URL(window.location.href).searchParams.get('step')
      const stage = STAGES.find((s) => s === (fromState ?? fromUrl))
      if (stage) setRequested(stage)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Keep the URL / history.state in step with the stage shown; focus its heading on change.
  const shown = useRef<InfoStage | null>(null)
  useEffect(() => {
    if (shown.current === current) return
    if (new URL(window.location.href).searchParams.get('step') !== current) writeStep(current, 'replace')
    shown.current = current
    headingRefs.current[current]?.focus()
  }, [current])

  function persist(next: InfoValues) {
    updateDraft({ ...next, menuSlug: menu.slug, startsAt })
  }

  function setField(field: InfoField, value: string) {
    const next = { ...values, [field]: value } as InfoValues
    setValues(next)
    persist(next)
    // Clear (or update) an error that is already shown; never add one while typing.
    if (errors[field]) setErrors((e) => ({ ...e, [field]: validateField(field, next, locale) ?? undefined }))
  }

  function blur(field: InfoField) {
    let next = values
    if (field === 'nameKana') {
      const converted = toHiragana(values.nameKana)
      if (
        converted !== values.nameKana &&
        validateField('nameKana', { ...values, nameKana: converted }, locale) === null
      ) {
        next = { ...values, nameKana: converted }
        setValues(next)
        persist(next)
      }
    }
    // Leaving an untouched empty field does not shout; "次へ" validates it.
    if (next[field] === '' && !errors[field]) return
    setErrors((e) => ({ ...e, [field]: validateField(field, next, locale) ?? undefined }))
  }

  function go(stage: InfoStage) {
    shown.current = null
    setRequested(stage)
    writeStep(stage, 'push')
  }

  function complete(stage: InfoStage, vals = values) {
    const errs = stageErrors(stage, vals, locale)
    const bad = Object.keys(errs) as InfoField[]
    if (bad.length > 0) {
      setErrors((e) => ({ ...e, ...errs }))
      fieldRefs.current[bad[0] as InfoField]?.focus()
      return
    }
    const remaining = firstIncompleteStage(vals, locale)
    if (stage === 'phone' && remaining === null) {
      router.push('/book/confirm')
      return
    }
    const after = STAGES.slice(STAGES.indexOf(stage) + 1).find((s) => !isStageComplete(s, vals, locale))
    go(after ?? remaining ?? 'phone')
  }

  const sectionTitle: Record<InfoStage, string> = {
    name: t('form.sectionName'),
    occupation: t('form.sectionOccupation'),
    phone: t('form.sectionPhone'),
  }
  const summaryValue: Record<InfoStage, ReactNode> = {
    name: (
      <>
        {values.name}
        {locale === 'ja' && values.nameKana ? t('form.kanaSummary', { kana: values.nameKana }) : ''}
      </>
    ),
    occupation: values.occupation ? t(`form.${values.occupation}`) : '',
    phone: values.phone,
  }
  const errorText = (field: InfoField) => (errors[field] ? t(`errors.${errors[field]}`) : undefined)
  const bind = (field: InfoField) => ({
    value: values[field],
    onChange: (e: { target: { value: string } }) => setField(field, e.target.value),
    onBlur: () => blur(field),
    ref: (el: HTMLElement | null) => {
      fieldRefs.current[field] = el
    },
  })

  function renderStage(stage: InfoStage) {
    switch (stage) {
      case 'name':
        return (
          <>
            <FieldWrapper
              id="name"
              label={t('form.name')}
              tag={{ text: tc('required') }}
              error={errorText('name')}
              errorPrefix={tc('errorPrefix')}
            >
              {(aria) => (
                <TextInput
                  {...aria}
                  {...bind('name')}
                  name="name"
                  autoComplete="name"
                  placeholder={t('form.nameHint')}
                />
              )}
            </FieldWrapper>
            {locale === 'ja' ? (
              <FieldWrapper
                id="nameKana"
                label={t('form.kana')}
                tag={{ text: tc('required') }}
                help={t('form.kanaHelp')}
                error={errorText('nameKana')}
                errorPrefix={tc('errorPrefix')}
              >
                {(aria) => (
                  <TextInput
                    {...aria}
                    {...bind('nameKana')}
                    name="full-name-phonetic"
                    autoComplete="off"
                    placeholder={t('form.kanaHint')}
                  />
                )}
              </FieldWrapper>
            ) : null}
          </>
        )
      case 'occupation':
        return (
          <>
            <RadioGroup
              name="occupation"
              value={values.occupation}
              labelledBy="stage-occupation"
              describedBy={errors.occupation ? 'occupation-err occupation-help' : 'occupation-help'}
              invalid={!!errors.occupation}
              options={[
                { value: 'student', label: t('form.student') },
                { value: 'worker', label: t('form.worker') },
              ]}
              onChange={(v) => {
                const next = { ...values, occupation: v }
                setValues(next)
                persist(next)
                setErrors((e) => ({ ...e, occupation: undefined }))
                // Selecting is the completion (CW-11): advance without "次へ".
                complete('occupation', next)
              }}
            />
            {errors.occupation ? (
              <p className="err mt-2" id="occupation-err">
                <Icon name="alert" />
                <span>
                  <span className="sr-only">{tc('errorPrefix')}</span>
                  {t(`errors.${errors.occupation}`)}
                </span>
              </p>
            ) : null}
            <p className="help mt-2" id="occupation-help">
              {t('form.occupationHelp')}
            </p>
          </>
        )
      default:
        return (
          <>
            <FieldWrapper
              id="phone"
              label={t('form.phone')}
              tag={{ text: tc('required') }}
              help={t('form.phoneHelp')}
              error={errorText('phone')}
              errorPrefix={tc('errorPrefix')}
            >
              {(aria) => (
                <TextInput {...aria} {...bind('phone')} name="phone" type="tel" inputMode="tel" autoComplete="tel" />
              )}
            </FieldWrapper>
            {noteOpen ? (
              <FieldWrapper
                id="note"
                label={t('form.note')}
                tag={{ text: tc('optional'), optional: true }}
                error={errorText('note')}
                errorPrefix={tc('errorPrefix')}
              >
                {(aria) => (
                  <>
                    <TextArea
                      {...aria}
                      {...bind('note')}
                      aria-describedby={[aria['aria-describedby'], 'note-count'].filter(Boolean).join(' ')}
                      name="note"
                      rows={4}
                      placeholder={t('form.notePlaceholder')}
                    />
                    <p className="count" id="note-count" aria-live="polite">
                      <span className="sr-only">{t('form.noteCountSr')}</span>
                      {t('form.noteCount', { count: values.note.length })}
                    </p>
                  </>
                )}
              </FieldWrapper>
            ) : (
              <Button
                variant="ghost"
                className="add-note"
                icon="plus"
                aria-expanded={false}
                aria-controls="note"
                onClick={() => {
                  setNoteOpen(true)
                  requestAnimationFrame(() => document.getElementById('note')?.focus())
                }}
              >
                <span>{t('form.addNote')}</span>
              </Button>
            )}
          </>
        )
    }
  }

  return (
    <>
      <SelectionSummary menu={menu} startsAt={startsAt} occupation={values.occupation} />
      <h1 className="page-h" id="info-h">
        {t('form.heading')}
      </h1>
      <p className="lead">{t('form.lead')}</p>

      <form
        id="info"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          complete(current)
        }}
      >
        {STAGES.map((stage, i) => {
          const done = isStageComplete(stage, values, locale)
          if (stage === current) {
            return (
              <section key={stage} className="fsec" aria-labelledby={`stage-${stage}`}>
                <h2
                  className="fsec-h"
                  id={`stage-${stage}`}
                  tabIndex={-1}
                  ref={(el) => {
                    headingRefs.current[stage] = el
                  }}
                >
                  <span>{sectionTitle[stage]}</span>
                  <span className="no" aria-hidden="true">
                    {t('form.stepOf', { n: i + 1 })}
                  </span>
                </h2>
                {renderStage(stage)}
              </section>
            )
          }
          // Not yet reached (and not filled in): not rendered at all (hidden from AT too).
          if (i > currentIdx && !done) return null
          return (
            <Card key={stage} className="step-sum">
              <span className="ok" aria-hidden="true">
                <Icon name="check" />
              </span>
              <p className="body">
                <span className="k">
                  {sectionTitle[stage]}
                  <span className="sr-only">{t('form.sectionDoneSr')}</span>
                </span>
                <span className="v">{summaryValue[stage]}</span>
              </p>
              <Button
                variant="ghost"
                aria-label={t('form.editAria', { section: sectionTitle[stage] })}
                onClick={() => go(stage)}
              >
                {tc('change')}
              </Button>
            </Card>
          )
        })}

        <div className="sticky-cta paper">
          <div className="in">
            <Button type="submit" variant="primary" block trailingIcon="arrowRight">
              {current === 'phone' ? t('form.toConfirm') : t('form.next')}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}
