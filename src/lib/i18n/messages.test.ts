import { describe, expect, it } from 'vitest'
import en from '../../../messages/en.json'
import ja from '../../../messages/ja.json'

/** /en must never fall back to Japanese (FR-C-13): both files have exactly the same keys. */
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('messages', () => {
  it('ja and en have identical key sets', () => {
    expect(keys(en).sort()).toEqual(keys(ja).sort())
  })
})
