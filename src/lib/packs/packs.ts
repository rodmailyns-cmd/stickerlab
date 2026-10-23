import { uid } from '../doc/factory'
import { WA_LIMITS } from '../export/limits'
import type { PackFiles } from '../export/pack'
import type { Issue, ValidatorPack } from '../export/validator'
import { exportSticker } from '../render/exporter'
import type { PackRecord, StickerRecord } from '../storage/db'

export function newPack(name: string, animated: boolean, publisher = ''): PackRecord {
  const now = Date.now()
  return {
    id: uid(),
    identifier: `stickerlab_${uid().toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    name,
    publisher,
    animated,
    items: [],
    tray: null,
    traySourceId: null,
    createdAt: now,
    updatedAt: now,
  }
}

export type AddResult = 'ok' | 'duplicate' | 'full' | 'kind'

export function canAdd(pack: PackRecord, s: StickerRecord): AddResult {
  if (pack.items.some((i) => i.stickerId === s.id)) return 'duplicate'
  if (pack.items.length >= WA_LIMITS.packMaxStickers) return 'full'
  if (pack.animated !== s.animated) return 'kind'
  return 'ok'
}

export const ADD_MESSAGES: Record<Exclude<AddResult, 'ok'>, string> = {
  duplicate: 'Ese sticker ya está en el pack.',
  full: 'El pack ya tiene 30 stickers (el máximo de WhatsApp).',
  kind: 'WhatsApp no permite mezclar stickers animados y estáticos en un pack.',
}

/** Icono de bandeja 96×96 PNG generado a partir de un sticker (primer fotograma). */
export async function makeTrayIcon(source: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(source)
  const c = document.createElement('canvas')
  c.width = c.height = WA_LIMITS.trayIconSize
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  const pad = 4
  const s = Math.min((96 - pad * 2) / bmp.width, (96 - pad * 2) / bmp.height)
  const w = bmp.width * s
  const h = bmp.height * s
  ctx.drawImage(bmp, (96 - w) / 2, (96 - h) / 2, w, h)
  bmp.close()
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
  return blob
}

export async function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  const bmp = await createImageBitmap(blob)
  const r = { width: bmp.width, height: bmp.height }
  bmp.close()
  return r
}

export function packStickers(pack: PackRecord, all: StickerRecord[]): StickerRecord[] {
  return pack.items.map((i) => all.find((s) => s.id === i.stickerId)).filter((s): s is StickerRecord => !!s)
}

/** Datos para el validador. */
export async function toValidatorPack(pack: PackRecord, all: StickerRecord[]): Promise<ValidatorPack> {
  const stickers = await Promise.all(
    pack.items.map(async (it) => {
      const s = all.find((x) => x.id === it.stickerId)
      if (!s) return null
      return { id: s.id, name: s.name, bytes: new Uint8Array(await s.webp.arrayBuffer()), emojis: it.emojis }
    }),
  )
  let tray: ValidatorPack['tray'] = null
  const trayBlob = await resolveTray(pack, all)
  if (trayBlob) {
    const size = await imageSize(trayBlob)
    tray = { bytes: new Uint8Array(await trayBlob.arrayBuffer()), ...size, mime: trayBlob.type }
  }
  return { name: pack.name, publisher: pack.publisher, animated: pack.animated, tray, stickers: stickers.filter((s): s is NonNullable<typeof s> => !!s) }
}

/** Icono efectivo del pack: el personalizado o uno generado del sticker elegido / primero. */
export async function resolveTray(pack: PackRecord, all: StickerRecord[]): Promise<Blob | null> {
  if (pack.tray) return pack.tray
  const src = all.find((s) => s.id === (pack.traySourceId ?? pack.items[0]?.stickerId))
  return src ? makeTrayIcon(src.webp) : null
}

export async function toPackFiles(pack: PackRecord, all: StickerRecord[]): Promise<PackFiles> {
  const tray = await resolveTray(pack, all)
  if (!tray) throw new Error('El pack no tiene icono')
  const stickers = await Promise.all(
    pack.items.map(async (it) => {
      const s = all.find((x) => x.id === it.stickerId)!
      return { name: s.name, bytes: new Uint8Array(await s.webp.arrayBuffer()), emojis: it.emojis }
    }),
  )
  return { identifier: pack.identifier, name: pack.name, publisher: pack.publisher, animated: pack.animated, tray: new Uint8Array(await tray.arrayBuffer()), stickers }
}

/**
 * Corrige automáticamente lo que se pueda: nombres, emojis, icono y stickers que
 * no cumplen (se vuelven a generar desde su proyecto con el optimizador).
 */
export async function autoFixPack(
  pack: PackRecord,
  all: StickerRecord[],
  issues: Issue[],
  saveSticker: (s: StickerRecord) => Promise<void>,
  onStep?: (msg: string) => void,
): Promise<PackRecord> {
  const p: PackRecord = structuredClone(pack)
  const codes = new Set(issues.map((i) => i.code))
  if (codes.has('pack-name-missing')) p.name = 'Mis stickers'
  if (codes.has('pack-name-long')) p.name = p.name.slice(0, WA_LIMITS.textFieldMax)
  if (codes.has('pack-author-missing')) p.publisher = 'StickerLab'
  if (codes.has('pack-author-long')) p.publisher = p.publisher.slice(0, WA_LIMITS.textFieldMax)
  for (const it of p.items) {
    if (it.emojis.length === 0) {
      const s = all.find((x) => x.id === it.stickerId)
      it.emojis = s?.emojis.length ? s.emojis.slice(0, 3) : ['😀']
    }
    if (it.emojis.length > 3) it.emojis = it.emojis.slice(0, 3)
  }
  if (codes.has('tray-format') || codes.has('tray-size') || codes.has('tray-bytes')) {
    onStep?.('Regenerando icono…')
    p.tray = pack.tray ? await makeTrayIcon(pack.tray) : null
  }
  const broken = new Set(
    issues.filter((i) => i.stickerId && ['sticker-bytes', 'sticker-dimensions', 'sticker-format', 'sticker-duration', 'sticker-frame-duration', 'sticker-no-loop'].includes(i.code)).map((i) => i.stickerId!),
  )
  for (const id of broken) {
    const s = all.find((x) => x.id === id)
    if (!s) continue
    onStep?.(`Optimizando "${s.name}"…`)
    const doc = structuredClone(s.doc)
    doc.animated = p.animated
    if (doc.duration > 10) doc.duration = 10
    const res = await exportSticker(doc, { start: { quality: Math.min(70, s.params.quality) } })
    await saveSticker({ ...s, doc, animated: res.animated, webp: new Blob([res.data as BlobPart], { type: 'image/webp' }), bytes: res.data.length, params: res.params, updatedAt: Date.now() })
  }
  p.updatedAt = Date.now()
  return p
}
