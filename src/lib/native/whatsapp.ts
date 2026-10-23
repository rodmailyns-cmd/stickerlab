import { registerPlugin, WebPlugin } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { buildContentsJson, stickerFileName, type PackFiles } from '../export/pack'
import { blobToBase64, isNative, withRetry } from './platform'

export interface WhatsAppStatus {
  installed: boolean
  consumer: boolean
  business: boolean
}

export interface NativePackInfo {
  identifier: string
  name: string
  publisher: string
  animated: boolean
  stickerCount: number
  imageDataVersion: number
}

/** Plugin nativo (android/app/src/main/java/com/stickerlab/app/whatsapp/WhatsAppStickersPlugin.kt). */
export interface WhatsAppStickersPlugin {
  getStatus(): Promise<WhatsAppStatus>
  savePack(opts: { pack: unknown; stagingDir: string }): Promise<NativePackInfo>
  listPacks(): Promise<{ packs: NativePackInfo[] }>
  deletePack(opts: { identifier: string }): Promise<{ deleted: boolean }>
  isPackAdded(opts: { identifier: string }): Promise<{ added: boolean; consumer: boolean; business: boolean }>
  addToWhatsApp(opts: { identifier: string; target?: 'consumer' | 'business' }): Promise<{ added: boolean; cancelled?: boolean }>
  saveToDevice(opts: { path?: string; data?: string; fileName: string; mimeType: string; collection: 'pictures' | 'downloads' }): Promise<{ uri: string }>
}

/** En el navegador no hay integración directa con WhatsApp. */
class WhatsAppStickersWeb extends WebPlugin implements WhatsAppStickersPlugin {
  async getStatus() {
    return { installed: false, consumer: false, business: false }
  }
  async savePack(): Promise<NativePackInfo> {
    throw this.unavailable('Solo en la app de Android')
  }
  async listPacks() {
    return { packs: [] }
  }
  async deletePack() {
    return { deleted: false }
  }
  async isPackAdded() {
    return { added: false, consumer: false, business: false }
  }
  async addToWhatsApp(): Promise<{ added: boolean }> {
    throw this.unavailable('Solo en la app de Android')
  }
  async saveToDevice(): Promise<{ uri: string }> {
    throw this.unavailable('Solo en la app de Android')
  }
}

export const WhatsAppStickers = registerPlugin<WhatsAppStickersPlugin>('WhatsAppStickers', {
  web: () => new WhatsAppStickersWeb(),
})

/** Códigos de error que devuelve el plugin. */
export type WhatsAppErrorCode = 'NOT_INSTALLED' | 'NOT_SUPPORTED' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'IO_ERROR' | 'PERMISSION_DENIED' | 'INVALID'

export function errorCode(e: unknown): WhatsAppErrorCode | undefined {
  return (e as { code?: WhatsAppErrorCode })?.code
}

export function errorMessage(e: unknown): string {
  const code = errorCode(e)
  const msg = (e as Error)?.message ?? String(e)
  switch (code) {
    case 'NOT_INSTALLED':
      return 'WhatsApp no está instalado en este teléfono.'
    case 'NOT_SUPPORTED':
      return 'Tu versión de WhatsApp no admite packs de otras apps. Actualízala desde Play Store.'
    case 'VALIDATION_ERROR':
      return `WhatsApp rechazó el pack: ${msg}`
    case 'PERMISSION_DENIED':
      return 'Sin permiso no puedo guardar el archivo.'
    default:
      return msg || 'Algo salió mal.'
  }
}

const retryable = (e: unknown) => {
  const c = errorCode(e)
  return c !== 'VALIDATION_ERROR' && c !== 'INVALID' && c !== 'NOT_INSTALLED' && c !== 'NOT_SUPPORTED'
}

/**
 * Copia el pack al almacenamiento interno de la app para que el ContentProvider lo sirva.
 * 1) escribe cada archivo en `wa-staging/<id>/` con Filesystem (uno a uno, para no saturar el puente);
 * 2) el plugin valida y lo mueve a `wa-packs/<id>/` de forma atómica.
 */
export async function syncPackToDevice(files: PackFiles, onProgress?: (done: number, total: number) => void): Promise<NativePackInfo> {
  const contents = buildContentsJson(files)
  const pack = contents.sticker_packs[0]
  const stagingDir = `wa-staging/${pack.identifier}`
  await Filesystem.rmdir({ path: stagingDir, directory: Directory.Data, recursive: true }).catch(() => {})
  const entries: [string, Uint8Array][] = [[pack.tray_image_file, files.tray], ...files.stickers.map((s, i): [string, Uint8Array] => [stickerFileName(i), s.bytes])]
  let done = 0
  for (const [name, bytes] of entries) {
    const data = await blobToBase64(new Blob([bytes as BlobPart]))
    await withRetry(() => Filesystem.writeFile({ path: `${stagingDir}/${name}`, data, directory: Directory.Data, recursive: true }))
    onProgress?.(++done, entries.length)
  }
  return withRetry(() => WhatsAppStickers.savePack({ pack, stagingDir }), 3, retryable)
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  if (!isNative) return { installed: false, consumer: false, business: false }
  try {
    return await WhatsAppStickers.getStatus()
  } catch {
    return { installed: false, consumer: false, business: false }
  }
}

export async function isPackAdded(identifier: string): Promise<boolean> {
  if (!isNative) return false
  try {
    return (await WhatsAppStickers.isPackAdded({ identifier })).added
  } catch {
    return false
  }
}

export const WHATSAPP_PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.whatsapp'
