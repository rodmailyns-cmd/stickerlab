import { saveAs } from 'file-saver'
import { isNative } from './native/platform'

/**
 * Descarga un archivo. En el APK lo guarda en el teléfono:
 * imágenes en Imágenes/StickerLab y el resto (ZIP, .wastickers) en Descargas/StickerLab.
 * Devuelve dónde quedó (para avisar al usuario) o null en la web.
 */
export async function download(blob: Blob, name: string): Promise<string | null> {
  if (!isNative) {
    saveAs(blob, name)
    return null
  }
  const { saveToDevice } = await import('./native/files')
  const pictures = /^image\//.test(blob.type) || /\.(webp|png)$/i.test(name)
  await saveToDevice(blob, name, pictures ? 'pictures' : 'downloads')
  return pictures ? 'Imágenes/StickerLab' : 'Descargas/StickerLab'
}

export function canShareFiles(files: File[]): boolean {
  if (isNative) return true
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files })
  } catch {
    return false
  }
}

/** Comparte con la hoja nativa del móvil. Devuelve false si no se pudo. */
export async function shareFiles(files: File[], title: string, text?: string): Promise<boolean> {
  if (isNative) {
    const { shareNative } = await import('./native/files')
    return shareNative(files, title, text)
  }
  if (!canShareFiles(files)) return false
  try {
    await navigator.share({ files, title, text })
    return true
  } catch (e) {
    // El usuario canceló: no es un error
    return (e as DOMException)?.name === 'AbortError'
  }
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

/** Descarga o guarda en el teléfono avisando del resultado (y de los errores). */
export async function saveFile(blob: Blob, name: string): Promise<boolean> {
  const { toast } = await import('@/store/ui')
  try {
    const where = await download(blob, name)
    if (where) toast(`Guardado en ${where}`, 'success')
    return true
  } catch (e) {
    console.error(e)
    const { errorMessage } = await import('./native/whatsapp')
    toast(`No se pudo guardar "${name}". ${errorMessage(e)}`, 'error')
    return false
  }
}
