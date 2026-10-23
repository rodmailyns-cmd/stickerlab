import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildContentsJson, buildFullZip, buildWastickers, type PackFiles } from '../src/lib/export/pack'
import { sanitizeIdentifier } from '../src/lib/export/limits'

const pack: PackFiles = {
  identifier: 'Mis Gatitos ñ!',
  name: 'Mis Gatitos',
  publisher: 'Ana',
  animated: true,
  tray: new Uint8Array([137, 80, 78, 71]),
  stickers: [1, 2, 3].map((i) => ({ name: `s${i}`, bytes: new Uint8Array([i]), emojis: ['😺', '❤️', '🎉', '🙃'] })),
}

async function toZip(blob: Blob) {
  return JSZip.loadAsync(await blob.arrayBuffer())
}

describe('empaquetado', () => {
  it('genera contents.json con el formato oficial', () => {
    const c = buildContentsJson(pack)
    const p = c.sticker_packs[0]
    expect(p.identifier).toBe('Mis_Gatitos_n')
    expect(p.animated_sticker_pack).toBe(true)
    expect(p.tray_image_file).toBe('tray.png')
    expect(p.stickers.map((s) => s.image_file)).toEqual(['01.webp', '02.webp', '03.webp'])
    expect(p.stickers[0].emojis).toHaveLength(3)
  })

  it('genera un .wastickers con título, autor, icono y stickers', async () => {
    const zip = await toZip(await buildWastickers(pack))
    const names = Object.keys(zip.files).sort()
    expect(names).toEqual(expect.arrayContaining(['author.txt', 'title.txt', 'tray.png', '01.webp', '02.webp', '03.webp']))
    expect(await zip.file('title.txt')!.async('string')).toBe('Mis Gatitos')
    expect(await zip.file('author.txt')!.async('string')).toBe('Ana')
  })

  it('genera el ZIP completo listo para el proyecto oficial', async () => {
    const zip = await toZip(await buildFullZip(pack))
    const names = Object.keys(zip.files)
    expect(names).toEqual(
      expect.arrayContaining([
        'LEEME.txt',
        'Mis_Gatitos.wastickers',
        'stickers/01.webp',
        'whatsapp-assets/contents.json',
        'whatsapp-assets/Mis_Gatitos_n/tray.png',
        'whatsapp-assets/Mis_Gatitos_n/03.webp',
      ]),
    )
    const contents = JSON.parse(await zip.file('whatsapp-assets/contents.json')!.async('string'))
    expect(contents.sticker_packs[0].stickers).toHaveLength(3)
  })

  it('limpia identificadores', () => {
    expect(sanitizeIdentifier('  Árbol  de-Navidad.2025 ✨ ')).toBe('Arbol_de-Navidad.2025')
    expect(sanitizeIdentifier('✨✨')).toBe('stickerlab_pack')
  })
})
