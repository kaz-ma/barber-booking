'use client'

import { useLocale, useTranslations } from 'next-intl'
import { FieldWrapper } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { RadioGroup } from '@/components/ui/radio-group'
import { TextArea, TextInput } from '@/components/ui/text-input'
import type { BookingErrorKey } from '../messages'
import type { InfoField, InfoValues } from '../validate'

export type InfoFieldsProps = {
  values: InfoValues
  errors: Partial<Record<InfoField, BookingErrorKey>>
  onChange: (field: InfoField, value: string) => void
  onBlur: (field: InfoField) => void
  fieldRef: (field: InfoField, el: HTMLElement | null) => void
}

/**
 * Step ③ on the top page: every field at once — name (+ furigana on /ja), occupation, phone
 * and the optional note, which is shown as an input like the others (no "add" button).
 * Errors appear on blur and on the final button, with the copy from booking.errors.
 */
export function InfoFields({ values, errors, onChange, onBlur, fieldRef }: InfoFieldsProps) {
  const t = useTranslations('booking')
  const tc = useTranslations('common')
  const locale = useLocale()
  const errorText = (field: InfoField) => (errors[field] ? t(`errors.${errors[field]}`) : undefined)
  const bind = (field: InfoField) => ({
    value: values[field],
    onChange: (e: { target: { value: string } }) => onChange(field, e.target.value),
    onBlur: () => onBlur(field),
    ref: (el: HTMLElement | null) => fieldRef(field, el),
  })
  return (
    <div className="ifields">
      <FieldWrapper
        id="name"
        label={t('form.name')}
        tag={{ text: tc('required') }}
        error={errorText('name')}
        errorPrefix={tc('errorPrefix')}
      >
        {(aria) => (
          <TextInput {...aria} {...bind('name')} name="name" autoComplete="name" placeholder={t('form.nameHint')} />
        )}
      </FieldWrapper>
      {locale === 'ja' ? (
        <FieldWrapper
          id="nameKana"
          label={t('form.kana')}
          tag={{ text: tc('required') }}
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

      <div className="field">
        <p className="flabel" id="occupation-l">
          {t('form.occupation')}
          <span className="req">{tc('required')}</span>
        </p>
        <RadioGroup
          name="occupation"
          value={values.occupation}
          labelledBy="occupation-l"
          describedBy={errors.occupation ? 'occupation-err occupation-help' : 'occupation-help'}
          invalid={!!errors.occupation}
          options={[
            { value: 'student', label: t('form.student') },
            { value: 'worker', label: t('form.worker') },
          ]}
          onChange={(v) => onChange('occupation', v)}
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
        <p className="help" id="occupation-help">
          {t('form.occupationHelp')}
        </p>
      </div>

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
              rows={3}
              placeholder={t('form.notePlaceholder')}
            />
            <p className="count" id="note-count" aria-live="polite">
              <span className="sr-only">{t('form.noteCountSr')}</span>
              {t('form.noteCount', { count: values.note.length })}
            </p>
          </>
        )}
      </FieldWrapper>
    </div>
  )
}
