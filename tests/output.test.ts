/**
 * Valida los packs reales exportados por la prueba E2E (scripts/e2e.mjs) contra los límites de WhatsApp.
 * Se omite si no existe la carpeta e2e-output/.
 */
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { getWebPInfo } from '../src/lib/webp/riff'
import { validatePack } from '../src/lib/export/validator'
import { WA_LIMITS } from '../src/lib/export/limits'

const OUT = path.resolve('e2e-output')
const zips = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('-whatsapp.zip')) : []

function pngSize(b: Uint8Array) {
  const v = new DataView(b.buffer, b.byteOffset)
  return { width: v.getUint32(16), height: v.getUint32(20) }
}

describe.skipIf(!zips.length)('packs exportados por la E2E', () => {
  for (const file of zips) {
    it(`${file} cumple todos los requisitos de WhatsApp`, async () => {
      const zip = await JSZip.loadAsync(fs.readFileSync(path.join(OUT, file)))
      const contents = JSON.parse(await zip.file('whatsapp-assets/contents.json')!.async('string'))
      const p = contents.sticker_packs[0]
      const dir = `whatsapp-assets/${p.identifier}/`
      const tray = await zip.file(dir + p.tray_image_file)!.async('uint8array')
      const stickers = await Promise.all(
        p.stickers.map(async (s: { image_file: string; emojis: string[] }) => ({
          id: s.image_file,
          name: s.image_file,
          bytes: await zip.file(dir + s.image_file)!.async('uint8array'),
          emojis: s.emojis,
        })),
      )
      const issues = validatePack({ name: p.name, publisher: p.publisher, animated: p.animated_sticker_pack, tray: { bytes: tray, ...pngSize(tray), mime: 'image/png' }, stickers })
      expect(issues).toEqual([])
      for (const s of stickers) {
        const info = getWebPInfo(s.bytes)
        expect(info.width).toBe(512)
        expect(info.height).toBe(512)
        expect(info.animated).toBe(p.animated_sticker_pack)
        if (info.animated) {
          expect(s.bytes.length).toBeLessThanOrEqual(WA_LIMITS.animatedMaxBytes)
          expect(info.durationMs).toBeLessThanOrEqual(10_000)
          expect(info.loopCount).toBe(0)
        } else {
          expect(s.bytes.length).toBeLessThanOrEqual(WA_LIMITS.staticMaxBytes)
          expect(info.hasAlpha).toBe(true)
        }
        console.log(`  ${file} → ${s.id}: ${(s.bytes.length / 1024).toFixed(1)} KB, ${info.animated ? `${info.frameCount} fotogramas, ${info.durationMs} ms` : 'estático'}`)
      }
      expect(pngSize(tray)).toEqual({ width: 96, height: 96 })
      expect(tray.length).toBeLessThanOrEqual(WA_LIMITS.trayMaxBytes)
      // El .wastickers también está y contiene lo mismo
      const wa = await JSZip.loadAsync(await zip.file(/\.wastickers$/)[0].async('uint8array'))
      expect(Object.keys(wa.files)).toEqual(expect.arrayContaining(['title.txt', 'author.txt', 'tray.png', '01.webp', '02.webp', '03.webp']))
    })
  }
})
