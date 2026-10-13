import { asErrorKey, type BookingErrorKey } from './messages'
import { bookingDraftSchema } from './schema'

/*
 * Per-field / per-stage validation for S-C-02b using the shared Zod schema (06_api.md §1.2):
 * the same rules run again on the server. Returns i18n keys under booking.errors.
 */

export type InfoValues = {
  name: string
  nameKana: string
  occupation: '' | 'student' | 'worker'
  phone: string
  note: string
}
export type InfoField = keyof InfoValues
export type InfoStage = 'name' | 'occupation' | 'phone'
export const STAGES: readonly InfoStage[] = ['name', 'occupation', 'phone']

export function stageFields(stage: InfoStage, locale: string): InfoField[] {
  switch (stage) {
    case 'name':
      return locale === 'ja' ? ['name', 'nameKana'] : ['name']
    case 'occupation':
      return ['occupation']
    default:
      return ['phone', 'note']
  }
}

export function validateField(field: InfoField, values: InfoValues, locale: string): BookingErrorKey | null {
  const shape = bookingDraftSchema.shape
  const value = values[field]
  if (field === 'nameKana') {
    if (locale !== 'ja') return null
    if (value.trim() === '') return 'kanaRequired'
  }
  const result = shape[field].safeParse(value)
  return result.success ? null : asErrorKey(result.error.issues[0]?.message)
}

export function stageErrors(stage: InfoStage, values: InfoValues, locale: string) {
  const errors: Partial<Record<InfoField, BookingErrorKey>> = {}
  for (const f of stageFields(stage, locale)) {
    const e = validateField(f, values, locale)
    if (e) errors[f] = e
  }
  return errors
}

export function isStageComplete(stage: InfoStage, values: InfoValues, locale: string): boolean {
  return Object.keys(stageErrors(stage, values, locale)).length === 0
}

export function firstIncompleteStage(values: InfoValues, locale: string): InfoStage | null {
  return STAGES.find((s) => !isStageComplete(s, values, locale)) ?? null
}

/** Field order on the page (furigana only on /ja), used to focus the first problem. */
export function infoFields(locale: string): InfoField[] {
  return STAGES.flatMap((s) => stageFields(s, locale))
}

/** Every field's error at once (the single "この内容で予約する" button validates all). */
export function allErrors(values: InfoValues, locale: string): Partial<Record<InfoField, BookingErrorKey>> {
  return Object.assign({}, ...STAGES.map((s) => stageErrors(s, values, locale)))
}
