import { describe, expect, it } from 'vitest'
import { extractFrameBitstream, getWebPInfo, isWebP, muxAnimatedWebP } from '../src/lib/webp/riff'
import { encodeWebP, makeImage } from './helpers'

describe('WebP RIFF', () => {
  it('lee un WebP estático 512×512 con transparencia', async () => {
    const bytes = await encodeWebP(makeImage(512, 512))
    expect(isWebP(bytes)).toBe(true)
    const info = getWebPInfo(bytes)
    expect(info).toMatchObject({ width: 512, height: 512, animated: false, hasAlpha: true, frameCount: 1 })
  })

  it('lee un WebP sin alfa (VP8 simple)', async () => {
    const bytes = await encodeWebP(makeImage(64, 32, 3, false))
    const info = getWebPInfo(bytes)
    expect(info.width).toBe(64)
    expect(info.height).toBe(32)
    expect(info.animated).toBe(false)
  })

  it('extrae el bitstream de un fotograma', async () => {
    const bs = extractFrameBitstream(await encodeWebP(makeImage(512, 512)))
    expect(bs.width).toBe(512)
    expect(bs.hasAlpha).toBe(true)
    expect(bs.chunks.length).toBeGreaterThan(0)
  })

  it('monta un WebP animado válido con bucle infinito', async () => {
    const frames = await Promise.all([1, 2, 3, 4].map(async (s) => ({ webp: await encodeWebP(makeImage(512, 512, s), 50), duration: 100 })))
    const anim = muxAnimatedWebP(frames, { width: 512, height: 512, loopCount: 0 })
    const info = getWebPInfo(anim)
    expect(info).toMatchObject({ width: 512, height: 512, animated: true, hasAlpha: true, frameCount: 4, durationMs: 400, loopCount: 0 })
    // Tamaño RIFF coherente
    const riffSize = new DataView(anim.buffer, anim.byteOffset).getUint32(4, true)
    expect(riffSize + 8).toBe(anim.length)
  })

  it('rechaza fotogramas de tamaño incorrecto', async () => {
    const f = { webp: await encodeWebP(makeImage(256, 256)), duration: 100 }
    expect(() => muxAnimatedWebP([f], { width: 512, height: 512 })).toThrow(/512/)
  })

  it('rechaza archivos que no son WebP', () => {
    expect(() => getWebPInfo(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toThrow()
  })
})
