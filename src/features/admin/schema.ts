import { z } from 'zod'
import { BOOKING_STATUSES } from '@/domain/booking-status'
import { HIRAGANA_RE, toHiragana } from '@/domain/kana'
import { isValidE164, normalizePhone } from '@/domain/phone'

/*
 * Admin Server Action inputs (06_api.md §3). Messages are keys resolved by
 * features/admin/strings.ts (admin is ja-only and outside next-intl).
 */

export const Uuid = z.uuid({ error: 'invalid' })
export const StartsAt = z.iso.datetime({ offset: true, error: 'startsAtInvalid' })
export const IsoDate = z.iso.date({ error: 'dateInvalid' })
export const LinkLocale = z.enum(['ja', 'en'])

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

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

export const PhoneE164 = z
  .string()
  .trim()
  .max(32, { error: 'phoneInvalid' })
  .transform(normalizePhone)
  .refine(isValidE164, { error: 'phoneInvalid' })

const Note = (max: number) => z.string().max(max, { error: 'noteTooLong' })

export const MANUAL_SOURCES = ['phone', 'walk_in', 'instagram', 'line', 'manual'] as const

export const createManualBookingSchema = z.object({
  customerId: z.preprocess(emptyToUndefined, Uuid.optional()),
  name: Name,
  nameKana: z.preprocess(emptyToUndefined, Kana.optional()),
  phone: z.preprocess(emptyToUndefined, PhoneE164.optional()),
  menuId: Uuid,
  startsAt: StartsAt,
  source: z.enum(MANUAL_SOURCES, { error: 'sourceRequired' }),
  ownerNote: z.preprocess(emptyToUndefined, Note(500).optional()),
  linkLocale: LinkLocale.default('ja'),
})
export type CreateManualBookingInput = z.output<typeof createManualBookingSchema>

export const updateBookingStatusSchema = z.object({
  bookingId: Uuid,
  to: z.enum(BOOKING_STATUSES),
  lateMinutes: z.coerce.number().int().min(0).max(180).optional(),
  reason: z.string().max(200).optional(),
})

export const undoSchema = z.object({ undoToken: z.string().min(10).max(1000) })
export const bookingIdSchema = z.object({ bookingId: Uuid })
export const ownerNoteSchema = z.object({ bookingId: Uuid, ownerNote: Note(500) })
export const reissueSchema = z.object({ bookingId: Uuid, linkLocale: LinkLocale })
export const idsSchema = z.object({ ids: z.array(Uuid).max(200) })

export const BLOCK_KINDS = ['break', 'private', 'closed'] as const
export const BLOCK_PRESETS = ['now60', 'now120', 'untilClose'] as const

export const createTimeBlockSchema = z
  .object({
    preset: z.enum(BLOCK_PRESETS).optional(),
    start: StartsAt.optional(),
    end: StartsAt.optional(),
    kind: z.enum(BLOCK_KINDS, { error: 'kindRequired' }),
    label: z.preprocess(emptyToUndefined, z.string().trim().max(50, { error: 'labelTooLong' }).optional()),
    force: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.preset) return
    if (!v.start || !v.end) {
      ctx.addIssue({ code: 'custom', path: ['start'], message: 'rangeRequired' })
      return
    }
    const s = Date.parse(v.start)
    const e = Date.parse(v.end)
    if (!(e > s)) ctx.addIssue({ code: 'custom', path: ['end'], message: 'endBeforeStart' })
    else if (e - s > 60 * 24 * 60 * 60_000) ctx.addIssue({ code: 'custom', path: ['end'], message: 'rangeTooLong' })
  })
export type CreateTimeBlockInput = z.output<typeof createTimeBlockSchema>

export const blockIdSchema = z.object({ blockId: Uuid })

const DayMinutes = z.coerce.number().int().min(0).max(1440)

export const businessHoursSchema = z.object({
  days: z
    .array(
      z
        .object({
          weekday: z.coerce.number().int().min(0).max(6),
          isClosed: z.boolean(),
          openMin: DayMinutes.optional(),
          closeMin: DayMinutes.optional(),
        })
        .superRefine((d, ctx) => {
          if (d.isClosed) return
          if (d.openMin === undefined || d.closeMin === undefined || d.openMin >= d.closeMin) {
            ctx.addIssue({ code: 'custom', path: ['closeMin'], message: 'hoursInvalid' })
          }
        }),
    )
    .length(7),
})

export const hourOverrideSchema = z
  .object({
    date: IsoDate,
    isClosed: z.boolean(),
    openMin: DayMinutes.optional(),
    closeMin: DayMinutes.optional(),
    reason: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  })
  .superRefine((d, ctx) => {
    if (d.isClosed) return
    if (d.openMin === undefined || d.closeMin === undefined || d.openMin >= d.closeMin) {
      ctx.addIssue({ code: 'custom', path: ['closeMin'], message: 'hoursInvalid' })
    }
  })

export const dateSchema = z.object({ date: IsoDate })

export const settingsSchema = z.object({
  slotStepMin: z.coerce
    .number()
    .int()
    .refine((v) => [10, 15, 20, 30, 60].includes(v), { error: 'invalid' }),
  leadTimeMin: z.coerce.number().int().min(0).max(2880),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  cancelDeadlineMin: z.coerce.number().int().min(0).max(10080),
  allowSameDay: z.boolean(),
  digestHourJst: z.coerce.number().int().min(0).max(23),
})

const Step5 = (min: number, max: number) =>
  z.coerce
    .number()
    .int()
    .min(min)
    .max(max)
    .refine((v) => v % 5 === 0, { error: 'step5' })

export const upsertMenuSchema = z
  .object({
    id: z.preprocess(emptyToUndefined, Uuid.optional()),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: 'slugInvalid' })
      .max(40),
    nameJa: z.string().trim().min(1, { error: 'nameRequired' }).max(40, { error: 'nameTooLong' }),
    nameEn: z.string().trim().min(1, { error: 'nameRequired' }).max(60, { error: 'nameTooLong' }),
    descriptionJa: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
    descriptionEn: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
    priceJpy: z.coerce.number().int().min(0, { error: 'priceInvalid' }).max(1_000_000),
    priceStudentJpy: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
    durationMin: Step5(15, 480),
    bufferAfterMin: Step5(0, 120),
    isActive: z.boolean(),
  })
  .superRefine((m, ctx) => {
    if (m.priceStudentJpy !== undefined && m.priceStudentJpy > m.priceJpy) {
      ctx.addIssue({ code: 'custom', path: ['priceStudentJpy'], message: 'studentPriceTooHigh' })
    }
  })
export type UpsertMenuInput = z.output<typeof upsertMenuSchema>

export const setMenuActiveSchema = z.object({ menuId: Uuid, isActive: z.boolean() })
export const moveMenuSchema = z.object({ menuId: Uuid, direction: z.enum(['up', 'down']) })

export const pushSubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.url({ protocol: /^https$/, error: 'invalid' }).max(2048),
    keys: z.object({ p256dh: z.string().min(16).max(256), auth: z.string().min(8).max(64) }),
  }),
  platform: z.enum(['ios', 'android', 'desktop', 'other']).default('other'),
  replaceEndpoint: z.preprocess(emptyToUndefined, z.url().max(2048).optional()),
})
export const endpointSchema = z.object({ endpoint: z.url().max(2048) })
export const subscriptionIdSchema = z.object({ subscriptionId: Uuid })

export const restrictionSchema = z.object({
  customerId: Uuid,
  restriction: z.enum(['none', 'dm_only', 'blocked']),
})
export const customerIdSchema = z.object({ customerId: Uuid })
export const anonymizeSchema = z.object({
  customerId: Uuid,
  confirmPhoneLast4: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  ),
})

export const otpCodeSchema = z.object({
  code: z
    .string()
    .transform((v) => v.normalize('NFKC').replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, { error: 'otpFormat' })),
  next: z.string().max(512).optional(),
})

/** Same-origin relative admin path only (open-redirect guard for ?next=). */
export function safeAdminNext(next: string | undefined): string {
  if (!next?.startsWith('/admin') || next.startsWith('//') || next.includes('\\')) return '/admin'
  if (next.startsWith('/admin/login')) return '/admin'
  return next
}
