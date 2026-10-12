/** NFKC, then katakana -> hiragana (ァ-ヶ shift by 0x60). The prolonged mark ー is kept. */
export function toHiragana(input: string): string {
  return input
    .normalize('NFKC')
    .trim()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

export const HIRAGANA_RE = /^[ぁ-ゖー\s　]+$/
