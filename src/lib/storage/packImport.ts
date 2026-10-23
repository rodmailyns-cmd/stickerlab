import JSZip from 'jszip'
import { newDoc, newImageLayer, uid } from '../doc/factory'
import { splitEmojis } from '../export/validator'
import { getWebPInfo } from '../webp/riff'
import { createAsset } from '../render/assets'
import { newPack } from '../packs/packs'
import type { PackRecord, StickerRecord } from './db'

interface ImportedPack {
  pack: PackRecord
  stickers: StickerRecord[]
}

interface ContentsSticker {
  image_file: string
  emojis?: string[]
  accessibility_text?: string
}
interface ContentsPack {
  identifier?: string
  name?: string
  publisher?: string
  tray_image_file?: string
  animated_sticker_pack?: boolean
  stickers: ContentsSticker[]
}

const bytesOf = async (zip: JSZip, path: string) => {
  const f = zip.file(path)
  return f ? new Uint8Array(await f.async('arraybuffer')) : null
}

/**
 * Importa un pack exportado como .wastickers o como ZIP completo (con whatsapp-assets/contents.json).
 * Cada sticker se guarda tal cual (mismo .webp) y con un proyecto sencillo para poder retocarlo.
 */
export async function importPackArchive(file: Blob, fileName = ''): Promise<ImportedPack> {
  let zip = await JSZip.loadAsync(await file.arrayBuffer())
  // El ZIP completo lleva dentro el .wastickers y la carpeta whatsapp-assets
  const contentsFile = zip.file('whatsapp-assets/contents.json')
  let name = fileName.replace(/\.(wastickers|zip)$/i, '') || 'Pack importado'
  let publisher = ''
  let entries: { path: string; emojis: string[]; label: string }[] = []
  let trayPath: string | null = null

  if (contentsFile) {
    const contents = JSON.parse(await contentsFile.async('string')) as { sticker_packs: ContentsPack[] }
    const p = contents.sticker_packs?.[0]
    if (!p) throw new Error('El ZIP no contiene ningún pack')
    const dir = Object.keys(zip.files).find((k) => k.startsWith('whatsapp-assets/') && k.endsWith(`/${p.stickers[0]?.image_file}`))?.replace(/[^/]+$/, '')
    if (!dir) throw new Error('Faltan los stickers del pack en el ZIP')
    name = p.name || name
    publisher = p.publisher || ''
    trayPath = p.tray_image_file ? dir + p.tray_image_file : null
    entries = p.stickers.map((s) => ({ path: dir + s.image_file, emojis: s.emojis ?? [], label: s.accessibility_text || s.image_file }))
  } else {
    const inner = Object.keys(zip.files).find((k) => k.toLowerCase().endsWith('.wastickers'))
    if (inner) zip = await JSZip.loadAsync(await zip.file(inner)!.async('arraybuffer'))
    const title = await zip.file('title.txt')?.async('string')
    const author = await zip.file('author.txt')?.async('string')
    name = title?.trim() || name
    publisher = author?.trim() || ''
    const emojiMap: Record<string, string[]> = JSON.parse((await zip.file('emojis.json')?.async('string')) ?? '{}')
    const webps = Object.keys(zip.files).filter((k) => /\.webp$/i.test(k) && !zip.files[k].dir).sort()
    trayPath = Object.keys(zip.files).find((k) => /(^|\/)tray[^/]*\.png$/i.test(k)) ?? Object.keys(zip.files).find((k) => /\.png$/i.test(k)) ?? null
    entries = webps.map((p) => ({ path: p, emojis: emojiMap[p.split('/').pop()!] ?? [], label: p.split('/').pop()!.replace(/\.webp$/i, '') }))
  }
  if (!entries.length) throw new Error('No encontré stickers .webp en el archivo')

  const now = Date.now()
  const stickers: StickerRecord[] = []
  let animated: boolean | null = null
  for (const [i, e] of entries.entries()) {
    const bytes = await bytesOf(zip, e.path)
    if (!bytes) continue
    const info = getWebPInfo(bytes)
    animated ??= info.animated
    const webp = new Blob([bytes as BlobPart], { type: 'image/webp' })
    const asset = await createAsset(webp)
    const doc = newDoc(`${name} ${i + 1}`)
    const layer = newImageLayer(asset.id, asset.width, asset.height, null, 'Sticker importado')
    layer.width = asset.width
    layer.height = asset.height
    doc.layers = [layer]
    doc.animated = info.animated
    doc.duration = info.animated ? Math.max(0.5, Math.min(10, (info.durationMs || 2000) / 1000)) : doc.duration
    stickers.push({
      id: uid(),
      name: e.label.slice(0, 60),
      tags: ['importado'],
      favorite: false,
      animated: info.animated,
      emojis: splitEmojis(e.emojis.join('')).slice(0, 3),
      doc,
      webp,
      bytes: bytes.length,
      params: { quality: 0, fps: doc.fps, colors: 0 },
      createdAt: now + i,
      updatedAt: now + i,
    })
  }

  const pack = newPack(name, animated ?? false, publisher)
  pack.items = stickers.filter((s) => s.animated === pack.animated).slice(0, 30).map((s) => ({ stickerId: s.id, emojis: s.emojis.length ? s.emojis : ['😀'] }))
  const tray = trayPath ? await bytesOf(zip, trayPath) : null
  if (tray) pack.tray = new Blob([tray as BlobPart], { type: 'image/png' })
  return { pack, stickers }
}
