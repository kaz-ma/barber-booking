import { z } from 'zod'
import { HIRAGANA_RE, toHiragana } from '@/domain/kana'
import { isValidE164, normalizePhone } from '@/domain/phone'

/*
 * Shared Zod 4 schemas (06_api.md §1.2, 03_screen_specs.md §1.2-1.3). Used by the client form
 * and re-run on the server. Messages are i18n keys under `booking.errors.*`; the client
 * resolves them with next-intl (API-09).
 */

export const Locale = z.enum(['ja', 'en'])
export type Locale = z.infer<typeof Locale>

export const MenuSlug = z
  .string({ error: 'menuRequired' })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: 'menuRequired' })
  .max(40)

/** e.g. 2026-11-04T18:00:00+09:00 — the server interprets the instant in Asia/Tokyo. */
export const StartsAt = z.iso.datetime({ offset: true, error: 'startsAtInvalid' })

export const PhoneE164 = z
  .string({ error: 'phoneRequired' })
  .trim()
  .min(1, { error: 'phoneRequired' })
  .max(32, { error: 'phoneInvalid' })
  .transform(normalizePhone)
  .refine(isValidE164, { error: 'phoneInvalid' })

const Name = z
  .string({ error: 'nameRequired' })
  .trim()
  .min(1, { error: 'nameRequired' })
  .max(50, { error: 'nameTooLong' })
  .regex(/^[^\p{Cc}]+$/u, { error: 'nameInvalid' })

const Kana = z
  .string()
  .transform(toHiragana)
  .pipe(z.string().max(50, { error: 'kanaTooLong' }).regex(HIRAGANA_RE, { error: 'kanaHiragana' }))

const optionalText = (max: number, key: string) =>
  z
    .string()
    .max(max, { error: key })
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v : undefined))

export const CancelToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

/** Draft fields collected over S-C-02 .. S-C-02b (no refinements so steps can `.pick()`). */
export const bookingDraftSchema = z.object({
  menuSlug: MenuSlug,
  startsAt: StartsAt,
  name: Name,
  nameKana: z.preprocess((v) => (v === '' ? undefined : v), Kana.optional()),
  occupation: z.enum(['student', 'worker'], { error: 'occupationRequired' }),
  phone: PhoneE164,
  note: optionalText(500, 'noteTooLong'),
})
export type BookingDraft = z.input<typeof bookingDraftSchema>

export const createBookingSchema = bookingDraftSchema
  .extend({
    locale: Locale,
    consent: z.literal('on', { error: 'consentRequired' }),
    turnstileToken: z.string().min(1, { error: 'botCheckFailed' }).max(2048),
    /** Honeypot. Validated as any short string: a filled value is handled after parsing. */
    website: z.string().max(500).default(''),
    submissionNonce: z.uuid({ error: 'invalid' }),
  })
  .superRefine((v, ctx) => {
    // ふりがな is required on /ja only (OI-13); /en does not render the field.
    if (v.locale === 'ja' && !v.nameKana) {
      ctx.addIssue({ code: 'custom', path: ['nameKana'], message: 'kanaRequired' })
    }
  })
export type CreateBookingInput = z.output<typeof createBookingSchema>

export const cancelBookingSchema = z.object({ locale: Locale, token: CancelToken })

/** FormData -> plain object of strings (Server Actions receive FormData). */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v
  return out
}
