import { describe, expect, it } from 'vitest'
import { jpegSize } from './jpeg'

/** SOI, an APP0 segment, SOF0 (precision 8, height, width, 3 components), EOI. */
function jpeg(width: number, height: number, sof = 0xc0): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]
  const sofSeg = [0xff, sof, 0x00, 0x11, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3]
  return new Uint8Array([0xff, 0xd8, ...app0, ...sofSeg, ...new Array(9).fill(0), 0xff, 0xd9])
}

describe('jpegSize', () => {
  it('reads baseline and progressive JPEG sizes', () => {
    expect(jpegSize(jpeg(1280, 960))).toEqual({ width: 1280, height: 960 })
    expect(jpegSize(jpeg(720, 1280, 0xc2))).toEqual({ width: 720, height: 1280 })
  })

  it('rejects other data', () => {
    expect(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBeNull()
    expect(jpegSize(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull()
    expect(jpegSize(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull()
    expect(jpegSize(jpeg(0, 10))).toBeNull()
  })
})
