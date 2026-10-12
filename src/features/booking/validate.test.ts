import { describe, expect, it } from 'vitest'
import { firstIncompleteStage, type InfoValues, stageErrors, validateField } from './validate'

const empty: InfoValues = { name: '', nameKana: '', occupation: '', phone: '', note: '' }

describe('S-C-02b validation', () => {
  it('returns the GOV.UK-style keys per field', () => {
    expect(validateField('name', empty, 'ja')).toBe('nameRequired')
    expect(validateField('nameKana', empty, 'ja')).toBe('kanaRequired')
    expect(validateField('nameKana', { ...empty, nameKana: 'yamada' }, 'ja')).toBe('kanaHiragana')
    expect(validateField('nameKana', { ...empty, nameKana: 'ヤマダ タロウ' }, 'ja')).toBeNull()
    expect(validateField('occupation', empty, 'ja')).toBe('occupationRequired')
    expect(validateField('phone', empty, 'ja')).toBe('phoneRequired')
    expect(validateField('phone', { ...empty, phone: '12345' }, 'ja')).toBe('phoneInvalid')
    expect(validateField('phone', { ...empty, phone: '090-1234-5678' }, 'ja')).toBeNull()
    expect(validateField('note', { ...empty, note: 'x'.repeat(501) }, 'ja')).toBe('noteTooLong')
  })

  it('does not require furigana on /en', () => {
    expect(stageErrors('name', { ...empty, name: 'Emma Wilson' }, 'en')).toEqual({})
    expect(stageErrors('name', { ...empty, name: '山田 太郎' }, 'ja')).toEqual({ nameKana: 'kanaRequired' })
  })

  it('finds the first stage that still needs input', () => {
    expect(firstIncompleteStage(empty, 'en')).toBe('name')
    expect(firstIncompleteStage({ ...empty, name: 'Emma' }, 'en')).toBe('occupation')
    expect(firstIncompleteStage({ ...empty, name: 'Emma', occupation: 'student' }, 'en')).toBe('phone')
    expect(
      firstIncompleteStage({ ...empty, name: 'Emma', occupation: 'student', phone: '+447700900123' }, 'en'),
    ).toBeNull()
  })
})
