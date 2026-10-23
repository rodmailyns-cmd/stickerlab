import { describe, expect, it } from 'vitest'
import { hasBlockingErrors, splitEmojis, validatePack, validateSticker, type ValidatorPack } from '../src/lib/export/validator'
import { muxAnimatedWebP } from '../src/lib/webp/riff'
import { encodeWebP, makeImage } from './helpers'

const png96 = { bytes: new Uint8Array(2000), width: 96, height: 96, mime: 'image/png' }

async function staticSticker(id: string) {
  return { id, name: id, bytes: await encodeWebP(makeImage(512, 512, id.length)), emojis: ['😀'] }
}
async function animatedSticker(id: string, frames = 3, duration = 100) {
  const fr = await Promise.all(Array.from({ length: frames }, async (_, i) => ({ webp: await encodeWebP(makeImage(512, 512, i + 1), 40), duration })))
  return { id, name: id, bytes: muxAnimatedWebP(fr, { width: 512, height: 512 }), emojis: ['🎉'] }
}

describe('validador de WhatsApp', () => {
  it('acepta un pack estático correcto', async () => {
    const pack: ValidatorPack = { name: 'Gatitos', publisher: 'Ana', animated: false, tray: png96, stickers: await Promise.all(['a', 'b', 'c'].map(staticSticker)) }
    expect(validatePack(pack)).toEqual([])
  })

  it('acepta un pack animado correcto', async () => {
    const pack: ValidatorPack = { name: 'Fiesta', publisher: 'Ana', animated: true, tray: png96, stickers: await Promise.all(['a', 'b', 'c'].map((i) => animatedSticker(i))) }
    expect(validatePack(pack)).toEqual([])
  })

  it('exige entre 3 y 30 stickers', async () => {
    const s = await staticSticker('a')
    const few = validatePack({ name: 'x', publisher: 'y', animated: false, tray: png96, stickers: [s] })
    expect(few.map((i) => i.code)).toContain('pack-too-few')
    const many = validatePack({ name: 'x', publisher: 'y', animated: false, tray: png96, stickers: Array(31).fill(s) })
    expect(many.map((i) => i.code)).toContain('pack-too-many')
  })

  it('no permite mezclar animados y estáticos', async () => {
    const pack: ValidatorPack = {
      name: 'Mix', publisher: 'Ana', animated: false, tray: png96,
      stickers: [await staticSticker('a'), await staticSticker('b'), await animatedSticker('c')],
    }
    const codes = validatePack(pack).map((i) => i.code)
    expect(codes).toContain('pack-mixed')
    expect(hasBlockingErrors(validatePack(pack))).toBe(true)
  })

  it('detecta tamaño, peso y dimensiones incorrectas', async () => {
    const small = { id: 's', name: 's', bytes: await encodeWebP(makeImage(256, 256)), emojis: ['😀'] }
    expect(validateSticker(small, false).map((i) => i.code)).toContain('sticker-dimensions')
    const heavy = await staticSticker('h')
    const padded = new Uint8Array(110 * 1024)
    padded.set(heavy.bytes)
    // Ajusta el tamaño RIFF para que siga siendo un WebP legible
    new DataView(padded.buffer).setUint32(4, padded.length - 8, true)
    const pad = padded.length - 12 - (heavy.bytes.length - 12) - 8
    padded.set(new TextEncoder().encode('JUNK'), heavy.bytes.length)
    new DataView(padded.buffer).setUint32(heavy.bytes.length + 4, pad, true)
    expect(validateSticker({ ...heavy, bytes: padded }, false).map((i) => i.code)).toContain('sticker-bytes')
  })

  it('detecta animaciones de más de 10 s y fotogramas < 8 ms', async () => {
    const long = await animatedSticker('l', 3, 4000)
    expect(validateSticker(long, true).map((i) => i.code)).toContain('sticker-duration')
    const fast = await animatedSticker('f', 2, 5)
    expect(validateSticker(fast, true).map((i) => i.code)).toContain('sticker-frame-duration')
  })

  it('valida el icono de bandeja', async () => {
    const stickers = await Promise.all(['a', 'b', 'c'].map(staticSticker))
    const codes = validatePack({ name: 'x', publisher: 'y', animated: false, tray: { bytes: new Uint8Array(60 * 1024), width: 128, height: 128, mime: 'image/jpeg' }, stickers }).map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['tray-size', 'tray-bytes', 'tray-format']))
    expect(validatePack({ name: 'x', publisher: 'y', animated: false, tray: null, stickers }).map((i) => i.code)).toContain('tray-missing')
  })

  it('controla los emojis por sticker', async () => {
    const s = await staticSticker('e')
    expect(validateSticker({ ...s, emojis: [] }, false).map((i) => i.code)).toContain('sticker-emojis-missing')
    expect(validateSticker({ ...s, emojis: ['😀', '😁', '😂', '🤣'] }, false).map((i) => i.code)).toContain('sticker-emojis-many')
  })

  it('separa emojis compuestos correctamente', () => {
    expect(splitEmojis('hola 👍🏽❤️👨‍👩‍👧 a')).toEqual(['👍🏽', '❤️', '👨‍👩‍👧'])
  })
})
