import { Camera, CameraDirection } from '@capacitor/camera'
import { Clipboard } from '@capacitor/clipboard'

/** Foto con la cámara nativa del teléfono. Devuelve null si el usuario cancela. */
export async function takeNativePhoto(): Promise<File | null> {
  try {
    const res = await Camera.takePhoto({ quality: 92, targetWidth: 1280, targetHeight: 1280, correctOrientation: true, cameraDirection: CameraDirection.Front })
    const src = res.webPath ?? res.uri
    if (!src) return null
    const blob = await (await fetch(src)).blob()
    return new File([blob], 'camara.jpg', { type: blob.type || 'image/jpeg' })
  } catch (e) {
    if (/cancel/i.test(String((e as Error)?.message))) return null
    throw e
  }
}

/** Imagen copiada en el portapapeles de Android (si la hay). */
export async function readClipboardImage(): Promise<File | null> {
  const { type, value } = await Clipboard.read()
  if (!value?.startsWith('data:image/') && !type?.startsWith('image/')) return null
  const url = value.startsWith('data:') ? value : `data:${type};base64,${value}`
  const blob = await (await fetch(url)).blob()
  return new File([blob], 'portapapeles.png', { type: blob.type || 'image/png' })
}
