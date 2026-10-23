import JSZip from 'jszip'
import type { Asset, StickerDoc } from '@/types/doc'
import { allAssets, allPacks, allStickers, docAssetIds, getAsset, putAsset, putPack, putSticker, type PackRecord, type StickerRecord } from './db'

const EXT: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' }

interface AssetMeta {
  id: string
  mime: string
  width: number
  height: number
  file: string
}

function addAssets(zip: JSZip, assets: Asset[]): AssetMeta[] {
  return assets.map((a) => {
    const file = `assets/${a.id}.${EXT[a.mime] ?? 'bin'}`
    zip.file(file, a.blob)
    return { id: a.id, mime: a.mime, width: a.width, height: a.height, file }
  })
}

async function readAssets(zip: JSZip, metas: AssetMeta[]) {
  for (const m of metas) {
    if (await getAsset(m.id)) continue
    const f = zip.file(m.file)
    if (!f) continue
    const blob = new Blob([await f.async('arraybuffer')], { type: m.mime })
    await putAsset({ id: m.id, blob, mime: m.mime, width: m.width, height: m.height })
  }
}

/** Proyecto editable .stickerlab: ZIP con el documento y sus imágenes. */
export async function exportProject(doc: StickerDoc): Promise<Blob> {
  const zip = new JSZip()
  const assets = (await Promise.all(docAssetIds(doc).map(getAsset))).filter((a): a is Asset => !!a)
  const metas = addAssets(zip, assets)
  zip.file('project.json', JSON.stringify({ format: 'stickerlab-project', version: 1, doc, assets: metas }, null, 1))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/x-stickerlab', compression: 'DEFLATE' })
}

export async function importProject(file: Blob): Promise<StickerDoc> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const json = zip.file('project.json')
  if (!json) throw new Error('El archivo no es un proyecto de StickerLab')
  const data = JSON.parse(await json.async('string')) as { format: string; doc: StickerDoc; assets: AssetMeta[] }
  if (data.format !== 'stickerlab-project') throw new Error('Formato desconocido')
  await readAssets(zip, data.assets)
  return data.doc
}

type StickerMeta = Omit<StickerRecord, 'webp'> & { webpFile: string }
type PackMeta = Omit<PackRecord, 'tray'> & { trayFile: string | null }

/** Copia de seguridad completa: stickers, packs e imágenes. */
export async function exportBackup(): Promise<Blob> {
  const zip = new JSZip()
  const [stickers, packs, assets] = await Promise.all([allStickers(), allPacks(), allAssets()])
  const used = new Set(stickers.flatMap((s) => docAssetIds(s.doc)))
  const metas = addAssets(
    zip,
    assets.filter((a) => used.has(a.id)),
  )
  const stickerMetas: StickerMeta[] = stickers.map(({ webp, ...s }) => {
    const webpFile = `stickers/${s.id}.webp`
    zip.file(webpFile, webp)
    return { ...s, webpFile }
  })
  const packMetas: PackMeta[] = packs.map(({ tray, ...p }) => {
    const trayFile = tray ? `trays/${p.id}.png` : null
    if (tray && trayFile) zip.file(trayFile, tray)
    return { ...p, trayFile }
  })
  zip.file('backup.json', JSON.stringify({ format: 'stickerlab-backup', version: 1, createdAt: Date.now(), stickers: stickerMetas, packs: packMetas, assets: metas }))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE' })
}

export async function importBackup(file: Blob): Promise<{ stickers: number; packs: number }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const json = zip.file('backup.json')
  if (!json) throw new Error('No es una copia de seguridad de StickerLab')
  const data = JSON.parse(await json.async('string')) as { format: string; stickers: StickerMeta[]; packs: PackMeta[]; assets: AssetMeta[] }
  if (data.format !== 'stickerlab-backup') throw new Error('Formato desconocido')
  await readAssets(zip, data.assets)
  for (const { webpFile, ...s } of data.stickers) {
    const f = zip.file(webpFile)
    if (!f) continue
    await putSticker({ ...s, webp: new Blob([await f.async('arraybuffer')], { type: 'image/webp' }) })
  }
  for (const { trayFile, ...p } of data.packs) {
    const f = trayFile ? zip.file(trayFile) : null
    await putPack({ ...p, tray: f ? new Blob([await f.async('arraybuffer')], { type: 'image/png' }) : null })
  }
  return { stickers: data.stickers.length, packs: data.packs.length }
}
