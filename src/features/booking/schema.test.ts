import { describe, expect, it } from 'vitest'
import { createBookingSchema } from './schema'

const base = {
  locale: 'ja',
  menuSlug: 'cut',
  startsAt: '2026-11-04T18:00:00+09:00',
  name: '山田 太郎',
  nameKana: 'ヤマダ タロウ',
  occupation: 'worker',
  phone: '090-1234-5678',
  consent: 'on',
  turnstileToken: 'tok',
  website: '',
  submissionNonce: '6f1c1f8e-4f5b-4d39-9f43-2a6d9b6b1e0a',
}

describe('createBookingSchema', () => {
  it('normalizes phone and kana', () => {
    const out = createBookingSchema.parse(base)
    expect(out.phone).toBe('+819012345678')
    expect(out.nameKana).toBe('やまだ たろう')
    expect(out.note).toBeUndefined()
  })
  it('requires kana on /ja but not on /en', () => {
    const ja = createBookingSchema.safeParse({ ...base, nameKana: '' })
    expect(ja.success).toBe(false)
    expect(ja.error?.issues.map((i) => i.message)).toContain('kanaRequired')
    expect(createBookingSchema.safeParse({ ...base, locale: 'en', nameKana: '' }).success).toBe(true)
  })
  it('rejects a start time without offset, missing consent and a long note', () => {
    expect(createBookingSchema.safeParse({ ...base, startsAt: '2026-11-04T18:00:00' }).success).toBe(false)
    expect(createBookingSchema.safeParse({ ...base, consent: '' }).success).toBe(false)
    const long = createBookingSchema.safeParse({ ...base, note: 'あ'.repeat(501) })
    expect(long.error?.issues[0]?.message).toBe('noteTooLong')
  })
})
