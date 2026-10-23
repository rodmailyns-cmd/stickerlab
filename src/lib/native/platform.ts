import { Capacitor } from '@capacitor/core'

/** true dentro del APK (Capacitor); false en el navegador. */
export const isNative = Capacitor.isNativePlatform()
export const isAndroid = Capacitor.getPlatform() === 'android'

/** Reintenta una operación que puede fallar por motivos pasajeros (E/S, memoria). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, isRetryable: (e: unknown) => boolean = () => true): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (!isRetryable(e) || i === attempts - 1) break
      await new Promise((r) => setTimeout(r, 300 * 2 ** i))
    }
  }
  throw last
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
