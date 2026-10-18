/**
 * Reads the pixel size of a baseline / progressive JPEG from its SOF segment (B3 karte photos:
 * the server checks what the browser sent instead of trusting it). Returns null for anything
 * that is not a well-formed JPEG header. Pure, no I/O.
 */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null
  let i = 2
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null
    const marker = bytes[i + 1] as number
    // Fill bytes and stand-alone markers carry no length.
    if (marker === 0xff) {
      i += 1
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) return null
    const len = ((bytes[i + 2] as number) << 8) | (bytes[i + 3] as number)
    if (len < 2) return null
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) {
      if (i + 9 > bytes.length) return null
      const height = ((bytes[i + 5] as number) << 8) | (bytes[i + 6] as number)
      const width = ((bytes[i + 7] as number) << 8) | (bytes[i + 8] as number)
      return width > 0 && height > 0 ? { width, height } : null
    }
    i += 2 + len
  }
  return null
}
