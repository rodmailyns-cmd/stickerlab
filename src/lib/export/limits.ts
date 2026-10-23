/**
 * Requisitos técnicos de WhatsApp para stickers.
 * Basados en la guía oficial y en el validador del proyecto de ejemplo de WhatsApp
 * (StickerPackValidator.java), que usa KB = 1024 bytes.
 */
export const KB = 1024

export const WA_LIMITS = {
  stickerSize: 512,
  staticMaxBytes: 100 * KB,
  animatedMaxBytes: 500 * KB,
  animatedMaxDurationMs: 10_000,
  animatedMinFrameMs: 8,
  trayIconSize: 96,
  trayIconMinSize: 24,
  trayIconMaxSize: 512,
  trayMaxBytes: 50 * KB,
  packMinStickers: 3,
  packMaxStickers: 30,
  emojisPerStickerMax: 3,
  emojisPerStickerMin: 1,
  textFieldMax: 128,
  minFps: 8,
  maxFps: 30,
} as const

/** Margen de seguridad para el optimizador (apunta un poco por debajo del límite). */
export const SAFETY_RATIO = 0.97

export function maxBytesFor(animated: boolean): number {
  return animated ? WA_LIMITS.animatedMaxBytes : WA_LIMITS.staticMaxBytes
}

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`
  return `${(bytes / KB).toFixed(bytes < 10 * KB ? 1 : 0)} KB`
}

/** Identificador válido para contents.json (letras, números, _ - . y espacios). */
export function sanitizeIdentifier(input: string): string {
  const clean = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\-. ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, WA_LIMITS.textFieldMax)
  return clean || 'stickerlab_pack'
}

/** Nombre de archivo seguro y legible. */
export function safeFileName(input: string, fallback = 'sticker'): string {
  const clean = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60)
  return clean || fallback
}
