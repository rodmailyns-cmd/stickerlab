import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { blobToBase64, withRetry } from './platform'
import { WhatsAppStickers } from './whatsapp'

/** Escribe un Blob en la carpeta de datos de la app (o en caché), con reintentos. */
export async function writeAppFile(path: string, blob: Blob, directory: Directory = Directory.Data): Promise<string> {
  const data = await blobToBase64(blob)
  const res = await withRetry(() => Filesystem.writeFile({ path, data, directory, recursive: true }))
  return res.uri
}

/** Guarda un archivo en Imágenes (stickers) o Descargas (ZIP, .wastickers) del teléfono. */
export async function saveToDevice(blob: Blob, fileName: string, collection: 'pictures' | 'downloads'): Promise<void> {
  const tmp = `exports/${Date.now()}-${fileName}`
  await writeAppFile(tmp, blob)
  try {
    await WhatsAppStickers.saveToDevice({ path: tmp, fileName, mimeType: blob.type || 'application/octet-stream', collection })
  } finally {
    void Filesystem.deleteFile({ path: tmp, directory: Directory.Data }).catch(() => {})
  }
}

/** Abre el menú de compartir de Android con uno o varios archivos. */
export async function shareNative(files: File[], title: string, text?: string): Promise<boolean> {
  const uris: string[] = []
  for (const f of files) uris.push(await writeAppFile(`share/${f.name}`, f, Directory.Cache))
  try {
    await Share.share({ title, text, files: uris, dialogTitle: title })
    return true
  } catch (e) {
    // Cancelar el menú no es un error
    return /cancel/i.test(String((e as Error)?.message))
  }
}
