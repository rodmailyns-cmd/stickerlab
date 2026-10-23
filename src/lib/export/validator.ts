import { getWebPInfo, isWebP } from '../webp/riff'
import { formatBytes, WA_LIMITS } from './limits'

export type IssueLevel = 'error' | 'warning'

export type IssueCode =
  | 'pack-too-few'
  | 'pack-too-many'
  | 'pack-mixed'
  | 'pack-name-missing'
  | 'pack-name-long'
  | 'pack-author-missing'
  | 'pack-author-long'
  | 'tray-missing'
  | 'tray-size'
  | 'tray-bytes'
  | 'tray-format'
  | 'sticker-format'
  | 'sticker-dimensions'
  | 'sticker-bytes'
  | 'sticker-kind'
  | 'sticker-duration'
  | 'sticker-frame-duration'
  | 'sticker-no-loop'
  | 'sticker-emojis-missing'
  | 'sticker-emojis-many'
  | 'sticker-no-alpha'

export interface Issue {
  level: IssueLevel
  code: IssueCode
  message: string
  stickerId?: string
  /** Si StickerLab puede corregirlo solo. */
  fixable: boolean
}

export interface ValidatorSticker {
  id: string
  name: string
  bytes: Uint8Array
  emojis: string[]
}

export interface ValidatorPack {
  name: string
  publisher: string
  animated: boolean
  tray: { bytes: Uint8Array; width: number; height: number; mime: string } | null
  stickers: ValidatorSticker[]
}

/** Comprueba un sticker suelto contra los límites de WhatsApp. */
export function validateSticker(s: ValidatorSticker, expectAnimated: boolean | null): Issue[] {
  const issues: Issue[] = []
  const label = s.name ? `"${s.name}"` : 'Un sticker'
  if (!isWebP(s.bytes)) {
    issues.push({ level: 'error', code: 'sticker-format', message: `${label} no es WebP.`, stickerId: s.id, fixable: true })
    return issues
  }
  let info
  try {
    info = getWebPInfo(s.bytes)
  } catch {
    issues.push({ level: 'error', code: 'sticker-format', message: `${label} está dañado.`, stickerId: s.id, fixable: true })
    return issues
  }
  if (info.width !== WA_LIMITS.stickerSize || info.height !== WA_LIMITS.stickerSize) {
    issues.push({
      level: 'error',
      code: 'sticker-dimensions',
      message: `${label} mide ${info.width}×${info.height}; debe ser 512×512.`,
      stickerId: s.id,
      fixable: true,
    })
  }
  if (expectAnimated !== null && info.animated !== expectAnimated) {
    issues.push({
      level: 'error',
      code: 'sticker-kind',
      message: expectAnimated
        ? `${label} es estático y este pack es animado. WhatsApp no permite mezclarlos.`
        : `${label} es animado y este pack es estático. WhatsApp no permite mezclarlos.`,
      stickerId: s.id,
      fixable: false,
    })
  }
  const max = info.animated ? WA_LIMITS.animatedMaxBytes : WA_LIMITS.staticMaxBytes
  if (s.bytes.length > max) {
    issues.push({
      level: 'error',
      code: 'sticker-bytes',
      message: `${label} pesa ${formatBytes(s.bytes.length)}; el máximo es ${formatBytes(max)}.`,
      stickerId: s.id,
      fixable: true,
    })
  }
  if (info.animated) {
    if (info.durationMs > WA_LIMITS.animatedMaxDurationMs) {
      issues.push({
        level: 'error',
        code: 'sticker-duration',
        message: `${label} dura ${(info.durationMs / 1000).toFixed(1)} s; el máximo es 10 s.`,
        stickerId: s.id,
        fixable: true,
      })
    }
    if (info.frameDurations.some((d) => d < WA_LIMITS.animatedMinFrameMs)) {
      issues.push({
        level: 'error',
        code: 'sticker-frame-duration',
        message: `${label} tiene fotogramas de menos de 8 ms.`,
        stickerId: s.id,
        fixable: true,
      })
    }
    if (info.loopCount !== 0) {
      issues.push({ level: 'warning', code: 'sticker-no-loop', message: `${label} no se repite en bucle.`, stickerId: s.id, fixable: true })
    }
  }
  if (s.emojis.length < WA_LIMITS.emojisPerStickerMin) {
    issues.push({
      level: 'warning',
      code: 'sticker-emojis-missing',
      message: `${label} no tiene emojis asociados (ayudan a buscarlo en WhatsApp).`,
      stickerId: s.id,
      fixable: true,
    })
  } else if (s.emojis.length > WA_LIMITS.emojisPerStickerMax) {
    issues.push({
      level: 'error',
      code: 'sticker-emojis-many',
      message: `${label} tiene ${s.emojis.length} emojis; el máximo es 3.`,
      stickerId: s.id,
      fixable: true,
    })
  }
  return issues
}

export function validatePack(pack: ValidatorPack): Issue[] {
  const issues: Issue[] = []
  const n = pack.stickers.length
  if (n < WA_LIMITS.packMinStickers) {
    issues.push({
      level: 'error',
      code: 'pack-too-few',
      message: `El pack tiene ${n} sticker${n === 1 ? '' : 's'}; WhatsApp necesita al menos 3.`,
      fixable: false,
    })
  }
  if (n > WA_LIMITS.packMaxStickers) {
    issues.push({ level: 'error', code: 'pack-too-many', message: `El pack tiene ${n} stickers; el máximo es 30.`, fixable: false })
  }
  if (!pack.name.trim()) issues.push({ level: 'error', code: 'pack-name-missing', message: 'El pack necesita un nombre.', fixable: true })
  if (pack.name.length > WA_LIMITS.textFieldMax)
    issues.push({ level: 'error', code: 'pack-name-long', message: 'El nombre del pack supera 128 caracteres.', fixable: true })
  if (!pack.publisher.trim()) issues.push({ level: 'error', code: 'pack-author-missing', message: 'Falta el autor del pack.', fixable: true })
  if (pack.publisher.length > WA_LIMITS.textFieldMax)
    issues.push({ level: 'error', code: 'pack-author-long', message: 'El autor supera 128 caracteres.', fixable: true })

  if (!pack.tray) {
    issues.push({ level: 'error', code: 'tray-missing', message: 'Falta el icono de bandeja (96×96 PNG).', fixable: true })
  } else {
    if (pack.tray.mime !== 'image/png') issues.push({ level: 'error', code: 'tray-format', message: 'El icono debe ser PNG.', fixable: true })
    if (pack.tray.width !== WA_LIMITS.trayIconSize || pack.tray.height !== WA_LIMITS.trayIconSize)
      issues.push({
        level: 'error',
        code: 'tray-size',
        message: `El icono mide ${pack.tray.width}×${pack.tray.height}; debe ser 96×96.`,
        fixable: true,
      })
    if (pack.tray.bytes.length > WA_LIMITS.trayMaxBytes)
      issues.push({
        level: 'error',
        code: 'tray-bytes',
        message: `El icono pesa ${formatBytes(pack.tray.bytes.length)}; el máximo es 50 KB.`,
        fixable: true,
      })
  }

  let animatedCount = 0
  for (const s of pack.stickers) {
    try {
      if (isWebP(s.bytes) && getWebPInfo(s.bytes).animated) animatedCount++
    } catch {
      /* se informa en validateSticker */
    }
  }
  if (animatedCount > 0 && animatedCount < n) {
    issues.push({
      level: 'error',
      code: 'pack-mixed',
      message: `Hay ${animatedCount} animados y ${n - animatedCount} estáticos. WhatsApp no permite mezclarlos en un pack.`,
      fixable: false,
    })
  }
  for (const s of pack.stickers) {
    issues.push(...validateSticker(s, pack.animated).filter((i) => !(i.code === 'sticker-kind' && animatedCount > 0 && animatedCount < n)))
  }
  return issues
}

export function hasBlockingErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.level === 'error')
}

/** Separa un texto en emojis (grafemas). */
export function splitEmojis(input: string): string[] {
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return [...seg.segment(input)].map((s) => s.segment).filter((s) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s))
}
