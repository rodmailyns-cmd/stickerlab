import { CANVAS_SIZE, type StickerDoc } from '@/types/doc'
import { maxBytesFor, SAFETY_RATIO } from '../export/limits'
import { frameDurations, frameTimes, optimizationLadder, optimizeToLimit, type EncodeParams, type OptimizeAttempt } from '../export/optimizer'
import { docAssetIds } from '../storage/db'
import { encoderPool } from '../webp/encoderPool'
import { muxAnimatedWebP } from '../webp/riff'
import { assetCache } from './assets'
import { ensureFont } from './fonts'
import { SceneRenderer } from './renderer'

export interface ExportProgress {
  stage: 'preparando' | 'renderizando' | 'codificando' | 'optimizando' | 'listo'
  progress: number
  detail?: string
}

export interface ExportResult {
  data: Uint8Array
  params: EncodeParams
  withinLimit: boolean
  attempts: OptimizeAttempt[]
  animated: boolean
  frameCount: number
  durationMs: number
}

/** Prepara un renderizador fuera de pantalla con todos los recursos cargados. */
async function prepare(doc: StickerDoc): Promise<{ renderer: SceneRenderer; dispose: () => void }> {
  await assetCache.loadAll(docAssetIds(doc))
  await Promise.all(doc.layers.flatMap((l) => (l.type === 'text' ? [ensureFont(l.fontFamily, l.bold, l.italic)] : [])))
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:512px;height:512px;pointer-events:none;opacity:0'
  document.body.appendChild(host)
  const renderer = new SceneRenderer(host, CANVAS_SIZE, false)
  return {
    renderer,
    dispose: () => {
      renderer.destroy()
      host.remove()
    },
  }
}

function grab(renderer: SceneRenderer): ImageData {
  const c = renderer.toCanvas()
  return c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
}

function hashImage(img: ImageData): number {
  const v = new Uint32Array(img.data.buffer, img.data.byteOffset, img.data.byteLength >> 2)
  let h = 0x811c9dc5
  for (let i = 0; i < v.length; i++) {
    h ^= v[i]
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Reduce el detalle (no el tamaño): baja a `scale` y vuelve a 512 con suavizado. */
function reduceDetail(img: ImageData, scale = 1): ImageData {
  if (scale >= 1) return img
  const full = document.createElement('canvas')
  full.width = img.width
  full.height = img.height
  full.getContext('2d')!.putImageData(img, 0, 0)
  const small = document.createElement('canvas')
  small.width = Math.max(1, Math.round(img.width * scale))
  small.height = Math.max(1, Math.round(img.height * scale))
  const sctx = small.getContext('2d')!
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(full, 0, 0, small.width, small.height)
  const out = document.createElement('canvas')
  out.width = img.width
  out.height = img.height
  const octx = out.getContext('2d', { willReadFrequently: true })!
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(small, 0, 0, out.width, out.height)
  return octx.getImageData(0, 0, out.width, out.height)
}

function encodeParams(img: ImageData, p: EncodeParams): Promise<Uint8Array> {
  return encoderPool.encode(reduceDetail(img, p.scale), p.quality, p.colors)
}

interface RenderedFrame {
  img: ImageData
  duration: number
}

/** Renderiza la animación a `fps`, uniendo fotogramas idénticos consecutivos. */
function renderFrames(renderer: SceneRenderer, doc: StickerDoc, fps: number): RenderedFrame[] {
  const times = frameTimes(doc.duration, fps)
  const durations = frameDurations(times.length, Math.round(Math.min(doc.duration, 10) * 1000))
  const out: RenderedFrame[] = []
  let lastHash = -1
  times.forEach((t, i) => {
    renderer.render(doc, { t, frameTime: t, mode: 'export' })
    const img = grab(renderer)
    const h = hashImage(img)
    if (h === lastHash && out.length) out[out.length - 1].duration += durations[i]
    else out.push({ img, duration: durations[i] })
    lastHash = h
  })
  return out
}

async function encodeFrames(frames: RenderedFrame[], p: EncodeParams, onFrame?: (i: number) => void): Promise<Uint8Array> {
  let done = 0
  const encoded = await Promise.all(
    frames.map((f) =>
      encodeParams(f.img, p).then((webp) => {
        onFrame?.(++done)
        return { webp, duration: f.duration }
      }),
    ),
  )
  if (encoded.length === 1) {
    // Un único fotograma: lo duplicamos para que siga siendo animado (WhatsApp lo exige en packs animados)
    const half = Math.max(8, Math.round(encoded[0].duration / 2))
    return muxAnimatedWebP([{ ...encoded[0], duration: half }, { ...encoded[0], duration: half }], { width: CANVAS_SIZE, height: CANVAS_SIZE, loopCount: 0 })
  }
  return muxAnimatedWebP(encoded, { width: CANVAS_SIZE, height: CANVAS_SIZE, loopCount: 0 })
}

function sampleIndices(n: number, k: number): number[] {
  if (n <= k) return Array.from({ length: n }, (_, i) => i)
  return Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1)))
}

/** Estima el peso de un animado codificando solo unos fotogramas de muestra. */
async function estimateAnimated(frames: RenderedFrame[], p: EncodeParams): Promise<number> {
  const idx = sampleIndices(frames.length, 5)
  const sizes = await Promise.all(idx.map((i) => encodeParams(frames[i].img, p).then((d) => d.length)))
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length
  return Math.round(avg * frames.length + 30 + frames.length * 24)
}

/**
 * Genera el WebP final de un sticker cumpliendo los límites de WhatsApp.
 * Si no cabe, baja calidad → FPS → colores automáticamente.
 */
export async function exportSticker(
  doc: StickerDoc,
  opts: { start?: Partial<EncodeParams>; onProgress?: (p: ExportProgress) => void } = {},
): Promise<ExportResult> {
  const report = opts.onProgress ?? (() => {})
  report({ stage: 'preparando', progress: 0 })
  const { renderer, dispose } = await prepare(doc)
  try {
    const start: EncodeParams = { quality: 82, fps: doc.fps, colors: 0, scale: 1, ...opts.start }
    const maxBytes = maxBytesFor(doc.animated)

    if (!doc.animated) {
      renderer.render(doc, { t: null, frameTime: 0, mode: 'export' })
      const img = grab(renderer)
      report({ stage: 'codificando', progress: 0.3 })
      const res = await optimizeToLimit(
        (p) => encodeParams(img, p),
        start,
        false,
        maxBytes,
        (a, i, n) => report({ stage: i ? 'optimizando' : 'codificando', progress: 0.3 + (0.7 * (i + 1)) / n, detail: `calidad ${a.params.quality}` }),
      )
      report({ stage: 'listo', progress: 1 })
      return { ...res, animated: false, frameCount: 1, durationMs: 0 }
    }

    // Animado
    let cache: { fps: number; frames: RenderedFrame[] } | null = null
    const framesFor = (fps: number) => {
      if (!cache || cache.fps !== fps) {
        report({ stage: 'renderizando', progress: 0.1, detail: `${fps} FPS` })
        cache = { fps, frames: renderFrames(renderer, doc, fps) }
      }
      return cache.frames
    }

    // Elige un buen punto de partida estimando con fotogramas de muestra
    const ladder = optimizationLadder(start, true)
    let startIdx = 0
    const target = maxBytes * SAFETY_RATIO * 0.95
    for (let i = 0; i < ladder.length; i++) {
      const est = await estimateAnimated(framesFor(ladder[i].fps), ladder[i])
      startIdx = i
      if (est <= target) break
    }

    let frameCount = 0
    const res = await optimizeToLimit(
      async (p) => {
        const frames = framesFor(p.fps)
        frameCount = frames.length
        return encodeFrames(frames, p, (n) =>
          report({ stage: 'codificando', progress: 0.2 + 0.75 * (n / frames.length), detail: `fotograma ${n}/${frames.length}` }),
        )
      },
      ladder[startIdx],
      true,
      maxBytes,
      (a) => report({ stage: 'optimizando', progress: 0.95, detail: `calidad ${a.params.quality}, ${a.params.fps} FPS` }),
    )
    report({ stage: 'listo', progress: 1 })
    return { ...res, animated: true, frameCount: Math.max(2, frameCount), durationMs: Math.round(Math.min(doc.duration, 10) * 1000) }
  } finally {
    dispose()
  }
}

/** Calculadora de peso en vivo: estimación rápida con los parámetros iniciales. */
export async function estimateSticker(doc: StickerDoc, quality = 82): Promise<{ bytes: number; maxBytes: number; animated: boolean }> {
  const { renderer, dispose } = await prepare(doc)
  try {
    const maxBytes = maxBytesFor(doc.animated)
    if (!doc.animated) {
      renderer.render(doc, { t: null, frameTime: 0, mode: 'export' })
      const data = await encoderPool.encode(grab(renderer), quality, 0)
      return { bytes: data.length, maxBytes, animated: false }
    }
    const times = frameTimes(doc.duration, doc.fps)
    const idx = sampleIndices(times.length, 4)
    const sizes: number[] = []
    for (const i of idx) {
      renderer.render(doc, { t: times[i], frameTime: times[i], mode: 'export' })
      sizes.push((await encoderPool.encode(grab(renderer), quality, 0)).length)
    }
    const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length
    return { bytes: Math.round(avg * times.length + 30 + times.length * 24), maxBytes, animated: true }
  } finally {
    dispose()
  }
}

/** Renderiza una miniatura PNG (para plantillas, iconos, etc.). */
export async function renderPreview(doc: StickerDoc, size = 256): Promise<HTMLCanvasElement> {
  const { renderer, dispose } = await prepare(doc)
  try {
    renderer.render(doc, { t: null, frameTime: 0, mode: 'export' })
    const src = renderer.toCanvas()
    const out = document.createElement('canvas')
    out.width = out.height = size
    out.getContext('2d')!.drawImage(src, 0, 0, size, size)
    return out
  } finally {
    dispose()
  }
}
