import { describe, expect, it } from 'vitest'
import { HIRAGANA_RE, toHiragana } from './kana'

describe('toHiragana', () => {
  it('converts katakana (incl. half-width) to hiragana and keeps ー', () => {
    expect(toHiragana('ヤマダ タロウ')).toBe('やまだ たろう')
    expect(toHiragana('ﾔﾏﾀﾞ')).toBe('やまだ')
    expect(toHiragana('ラーメン')).toBe('らーめん')
  })
  it('accepted output matches the hiragana pattern', () => {
    expect(HIRAGANA_RE.test(toHiragana('ヤマダ　タロウ'))).toBe(true)
    expect(HIRAGANA_RE.test(toHiragana('Yamada'))).toBe(false)
  })
})
