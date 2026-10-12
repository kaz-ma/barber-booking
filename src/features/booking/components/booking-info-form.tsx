'use client'

import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { type Draft, saveDraft, useDraft } from '../draft'
import { asErrorKey } from '../messages'
import { bookingDraftSchema } from '../schema'
import { SelectionSummary } from './selection-summary'
import type { BookingMenu } from './types'

type Field = 'name' | 'nameKana' | 'occupation' | 'phone' | 'note'
const EMPTY: Omit<Draft, 'menuSlug' | 'startsAt'> = { name: '', nameKana: '', occupation: '', phone: '', note: '' }

/**
 * S-C-02b (minimal). Validates with the shared Zod schema, stores the draft in
 * sessionStorage and moves on to /book/confirm. TODO(UI slice): staged reveal per field
 * group with history.state, focus management and the comps' layout (03_screen_specs.md §1.4).
 */
export function BookingInfoForm({ menus }: { menus: BookingMenu[] }) {
  const t = useTranslations('booking')
  const params = useSearchParams()
  const draft = useDraft()
  const menuSlug = params.get('menu') ?? ''
  const startsAt = params.get('startsAt') ?? ''
  const menu = menus.find((m) => m.slug === menuSlug)

  if (!menu || !startsAt) {
    return (
      <p>
        <Link href="/book" className="underline">
          {t('steps.menu')}
        </Link>
      </p>
    )
  }
  // Wait for the client snapshot so a restored draft becomes the initial state (no effect).
  if (draft === undefined) return null
  const initial = draft
    ? { name: draft.name, nameKana: draft.nameKana, occupation: draft.occupation, phone: draft.phone, note: draft.note }
    : EMPTY
  return <InfoFields menu={menu} startsAt={startsAt} initial={initial} />
}

function InfoFields({
  menu,
  startsAt,
  initial,
}: {
  menu: BookingMenu
  startsAt: string
  initial: Omit<Draft, 'menuSlug' | 'startsAt'>
}) {
  const t = useTranslations('booking')
  const locale = useLocale()
  const router = useRouter()
  const menuSlug = menu.slug
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})

  const set = (field: Field) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = bookingDraftSchema.safeParse({ menuSlug, startsAt, ...values })
    const next: Partial<Record<Field, string>> = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field
        next[field] ??= asErrorKey(issue.message)
      }
    }
    if (locale === 'ja' && values.nameKana.trim() === '') next.nameKana = 'kanaRequired'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    saveDraft({ menuSlug, startsAt, ...values })
    router.push('/book/confirm')
  }

  const err = (field: Field) =>
    errors[field] ? (
      <p id={`${field}-error`} className="text-sm text-accent">
        {t(`errors.${asErrorKey(errors[field])}`)}
      </p>
    ) : null
  const input = 'block w-full min-h-11 rounded-sm border border-border bg-bg-card px-3'

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <SelectionSummary menu={menu} startsAt={startsAt} occupation={values.occupation} />
      <div>
        <label htmlFor="name" className="font-bold">
          {t('form.name')}
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={set('name')}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          placeholder={t('form.nameHint')}
          className={input}
        />
        {err('name')}
      </div>
      {locale === 'ja' ? (
        <div>
          <label htmlFor="nameKana" className="font-bold">
            {t('form.kana')}
          </label>
          <input
            id="nameKana"
            name="full-name-phonetic"
            value={values.nameKana}
            onChange={set('nameKana')}
            aria-invalid={!!errors.nameKana}
            aria-describedby={errors.nameKana ? 'nameKana-error' : undefined}
            placeholder={t('form.kanaHint')}
            className={input}
          />
          {err('nameKana')}
        </div>
      ) : null}
      <fieldset>
        <legend className="font-bold">{t('form.occupation')}</legend>
        <div className="flex gap-4">
          {(['student', 'worker'] as const).map((o) => (
            <label key={o} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="occupation"
                value={o}
                checked={values.occupation === o}
                onChange={set('occupation')}
              />
              {t(`form.${o}`)}
            </label>
          ))}
        </div>
        {err('occupation')}
      </fieldset>
      <div>
        <label htmlFor="phone" className="font-bold">
          {t('form.phone')}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={set('phone')}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'phone-error' : undefined}
          placeholder={t('form.phoneHint')}
          className={input}
        />
        {err('phone')}
      </div>
      <div>
        <label htmlFor="note" className="font-bold">
          {t('form.note')}
        </label>
        <textarea id="note" name="note" value={values.note} onChange={set('note')} rows={3} className={input} />
        <p className="text-sm text-fg-muted">{t('form.noteCount', { count: 500 - values.note.length })}</p>
        {err('note')}
      </div>
      <button type="submit" className="min-h-14 w-full rounded-sm bg-accent font-bold text-on-accent">
        {t('form.toConfirm')}
      </button>
    </form>
  )
}
