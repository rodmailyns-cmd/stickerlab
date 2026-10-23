import { nanoid } from 'nanoid'
import type { Asset } from '@/types/doc'
import { getAsset, putAsset } from '../storage/db'

export type Drawable = (ImageBitmap | HTMLCanvasElement | HTMLImageElement) & { width: number; height: number }

/** Caché en memoria de imágenes decodificadas, respaldada por IndexedDB. */
class AssetCache {
  private images = new Map<string, Drawable>()
  private pending = new Map<string, Promise<Drawable | null>>()
  private listeners = new Set<() => void>()

  get(id: string): Drawable | null {
    const img = this.images.get(id)
    if (img) return img
    void this.load(id)
    return null
  }

  has(id: string) {
    return this.images.has(id)
  }

  onLoad(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  load(id: string): Promise<Drawable | null> {
    const ready = this.images.get(id)
    if (ready) return Promise.resolve(ready)
    let p = this.pending.get(id)
    if (!p) {
      p = (async () => {
        const asset = await getAsset(id)
        if (!asset) return null
        const bmp = await createImageBitmap(asset.blob)
        this.images.set(id, bmp)
        this.listeners.forEach((l) => l())
        return bmp as Drawable
      })().finally(() => this.pending.delete(id))
      this.pending.set(id, p)
    }
    return p
  }

  async loadAll(ids: string[]) {
    await Promise.all(ids.map((id) => this.load(id)))
  }

  /** Libera de la memoria las imágenes que no estén en `keep` (al cerrar o cambiar de proyecto). */
  retainOnly(keep: Set<string>) {
    for (const [id, img] of this.images) {
      if (keep.has(id)) continue
      if ('close' in img && typeof img.close === 'function') img.close()
      this.images.delete(id)
    }
  }

  /** Registra una imagen ya decodificada (al importar) para no volver a leerla. */
  prime(id: string, img: Drawable) {
    this.images.set(id, img)
  }
}

export const assetCache = new AssetCache()

/** Guarda un blob como asset y lo deja listo en la caché. */
export async function createAsset(blob: Blob): Promise<Asset> {
  const bmp = await createImageBitmap(blob)
  const asset: Asset = { id: nanoid(12), blob, mime: blob.type || 'image/png', width: bmp.width, height: bmp.height }
  await putAsset(asset)
  assetCache.prime(asset.id, bmp)
  return asset
}
