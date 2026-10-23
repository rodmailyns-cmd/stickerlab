import { SAFETY_RATIO, WA_LIMITS } from './limits'

/** Parámetros con los que se codifica un sticker. */
export interface EncodeParams {
  quality: number
  fps: number
  /** Niveles por canal para posterizar (0 = sin reducir colores). */
  colors: number
  /** Resolución interna del detalle (1 = completa). El archivo sigue siendo 512×512. */
  scale?: number
}

export interface OptimizeAttempt {
  params: EncodeParams
  bytes: number
}

export interface OptimizeResult {
  data: Uint8Array
  params: EncodeParams
  attempts: OptimizeAttempt[]
  withinLimit: boolean
}

const QUALITY_STEPS = [80, 70, 60, 50, 40]
const FPS_STEPS = [24, 20, 15, 12, 10, 8]
const COLOR_STEPS = [32, 16]
const LAST_RESORT_QUALITY = [30, 20, 10]
/** Solo animados y como último recurso: menos fotogramas que el mínimo del control. */
const EMERGENCY_FPS = [6, 5, 4]

function same(a: EncodeParams, b: EncodeParams) {
  return a.quality === b.quality && a.fps === b.fps && a.colors === b.colors && (a.scale ?? 1) === (b.scale ?? 1)
}

/**
 * Escalera de optimización: primero baja la calidad, luego los FPS (solo animados),
 * después reduce detalle y colores, y por último baja la calidad al mínimo.
 * Cada paso es igual o más agresivo que el anterior.
 */
export function optimizationLadder(start: EncodeParams, animated: boolean): EncodeParams[] {
  const ladder: EncodeParams[] = []
  const push = (p: EncodeParams) => {
    if (!ladder.some((l) => same(l, p))) ladder.push(p)
  }
  const s0 = start.scale ?? 1
  push({ ...start, scale: s0 })
  for (const q of QUALITY_STEPS) if (q < start.quality) push({ ...start, scale: s0, quality: q })
  const q = Math.min(start.quality, QUALITY_STEPS[QUALITY_STEPS.length - 1])
  let fps = start.fps
  if (animated) {
    for (const f of FPS_STEPS) {
      if (f < start.fps && f >= WA_LIMITS.minFps) {
        fps = f
        push({ quality: q, fps: f, colors: start.colors, scale: s0 })
      }
    }
  }
  const s1 = Math.min(s0, 0.75)
  push({ quality: q, fps, colors: start.colors, scale: s1 })
  let colors = start.colors
  for (const c of COLOR_STEPS) {
    if (colors === 0 || c < colors) {
      colors = c
      push({ quality: q, fps, colors, scale: s1 })
    }
  }
  const s2 = Math.min(s1, 0.5)
  push({ quality: q, fps, colors, scale: s2 })
  for (const lq of LAST_RESORT_QUALITY) push({ quality: Math.min(q, lq), fps, colors: 8, scale: s2 })
  if (animated) for (const f of EMERGENCY_FPS) if (f < fps) push({ quality: 10, fps: f, colors: 8, scale: s2 })
  return ladder
}

/**
 * Prueba la escalera hasta que el resultado cabe en `maxBytes` (con margen de seguridad).
 * `encode` debe devolver el archivo final para esos parámetros.
 */
export async function optimizeToLimit(
  encode: (p: EncodeParams) => Promise<Uint8Array>,
  start: EncodeParams,
  animated: boolean,
  maxBytes: number,
  onAttempt?: (a: OptimizeAttempt, index: number, total: number) => void,
): Promise<OptimizeResult> {
  const target = Math.floor(maxBytes * SAFETY_RATIO)
  const ladder = optimizationLadder(start, animated)
  const attempts: OptimizeAttempt[] = []
  let best: { data: Uint8Array; params: EncodeParams } | null = null
  for (let i = 0; i < ladder.length; i++) {
    const params = ladder[i]
    const data = await encode(params)
    const attempt = { params, bytes: data.length }
    attempts.push(attempt)
    onAttempt?.(attempt, i, ladder.length)
    if (!best || data.length < best.data.length) best = { data, params }
    if (data.length <= target) return { data, params, attempts, withinLimit: true }
  }
  // best nunca es null porque la escalera tiene al menos un paso
  const b = best!
  return { data: b.data, params: b.params, attempts, withinLimit: b.data.length <= maxBytes }
}

/** Posterización: reduce cada canal a `levels` niveles (mejora mucho la compresión). */
export function posterize(data: Uint8ClampedArray, levels: number): void {
  if (levels <= 0 || levels >= 256) return
  const step = 255 / (levels - 1)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(Math.round(data[i] / step) * step)
    data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step)
    data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step)
  }
}

/** Índices de fotogramas a muestrear para pasar de `srcFps` a `dstFps` durante `duration` s. */
export function frameTimes(duration: number, fps: number): number[] {
  const count = Math.max(1, Math.round(Math.min(duration, WA_LIMITS.animatedMaxDurationMs / 1000) * fps))
  return Array.from({ length: count }, (_, i) => i / fps)
}

/**
 * Reparte la duración total (ms) entre `count` fotogramas usando enteros,
 * de modo que la suma sea exacta y cada uno respete el mínimo de WhatsApp.
 */
export function frameDurations(count: number, totalMs: number): number[] {
  const total = Math.min(totalMs, WA_LIMITS.animatedMaxDurationMs)
  const out: number[] = []
  let acc = 0
  for (let i = 0; i < count; i++) {
    const next = Math.round(((i + 1) * total) / count)
    out.push(Math.max(WA_LIMITS.animatedMinFrameMs, next - acc))
    acc = next
  }
  return out
}
