import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Asset, StickerDoc } from '@/types/doc'
import type { EncodeParams } from '../export/optimizer'

export interface StickerRecord {
  id: string
  name: string
  tags: string[]
  favorite: boolean
  animated: boolean
  emojis: string[]
  doc: StickerDoc
  webp: Blob
  bytes: number
  params: EncodeParams
  createdAt: number
  updatedAt: number
}

export interface PackItem {
  stickerId: string
  emojis: string[]
}

export interface PackRecord {
  id: string
  identifier: string
  name: string
  publisher: string
  animated: boolean
  items: PackItem[]
  /** Icono personalizado (PNG 96×96). Si es null se genera a partir de un sticker. */
  tray: Blob | null
  traySourceId: string | null
  createdAt: number
  updatedAt: number
  /** Última vez que se copió al almacenamiento de la app Android para WhatsApp. */
  syncedAt?: number
}

interface StickerLabDB extends DBSchema {
  assets: { key: string; value: Asset }
  stickers: { key: string; value: StickerRecord; indexes: { updatedAt: number } }
  packs: { key: string; value: PackRecord; indexes: { updatedAt: number } }
  meta: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<StickerLabDB>> | null = null

export function db(): Promise<IDBPDatabase<StickerLabDB>> {
  dbPromise ??= openDB<StickerLabDB>('stickerlab', 1, {
    upgrade(d) {
      d.createObjectStore('assets', { keyPath: 'id' })
      d.createObjectStore('stickers', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt')
      d.createObjectStore('packs', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt')
      d.createObjectStore('meta')
    },
  })
  return dbPromise
}

export async function putAsset(a: Asset) {
  await (await db()).put('assets', a)
}
export async function getAsset(id: string) {
  return (await db()).get('assets', id)
}
export async function allAssets() {
  return (await db()).getAll('assets')
}

export async function putSticker(s: StickerRecord) {
  await (await db()).put('stickers', s)
}
export async function getSticker(id: string) {
  return (await db()).get('stickers', id)
}
export async function allStickers() {
  const list = await (await db()).getAll('stickers')
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}
export async function deleteSticker(id: string) {
  await (await db()).delete('stickers', id)
}

export async function putPack(p: PackRecord) {
  await (await db()).put('packs', p)
}
export async function allPacks() {
  const list = await (await db()).getAll('packs')
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}
export async function deletePack(id: string) {
  await (await db()).delete('packs', id)
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('meta', key)) as T | undefined
}
export async function setMeta(key: string, value: unknown) {
  await (await db()).put('meta', value, key)
}

/** IDs de assets usados por un documento. */
export function docAssetIds(doc: StickerDoc): string[] {
  const ids = new Set<string>()
  for (const l of doc.layers) {
    if (l.type !== 'image') continue
    ids.add(l.assetId)
    if (l.originalAssetId) ids.add(l.originalAssetId)
    l.frames?.forEach((f) => ids.add(f.assetId))
  }
  return [...ids]
}

/** Borra los assets que ningún sticker ni el borrador del editor usan. */
export async function garbageCollectAssets(extraDocs: StickerDoc[] = []) {
  const d = await db()
  const used = new Set<string>()
  for (const s of await d.getAll('stickers')) docAssetIds(s.doc).forEach((id) => used.add(id))
  for (const doc of extraDocs) docAssetIds(doc).forEach((id) => used.add(id))
  const draft = (await d.get('meta', 'draft')) as { doc: StickerDoc } | undefined
  if (draft?.doc) docAssetIds(draft.doc).forEach((id) => used.add(id))
  const tx = d.transaction('assets', 'readwrite')
  for (const key of await tx.store.getAllKeys()) if (!used.has(key)) await tx.store.delete(key)
  await tx.done
}
