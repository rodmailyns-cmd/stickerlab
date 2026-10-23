import type { ImageLayer } from '@/types/doc'
import { cropPath } from './shapes'

export interface ProcessedImage {
  canvas: HTMLCanvasElement
  /** Relleno añadido en cada lado (en unidades de la capa) por el contorno. */
  pad: number
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/**
 * Dibuja un contorno alrededor de la silueta (canal alfa) de `src`.
 * Técnica: estampar la silueta coloreada en un círculo de desplazamientos.
 */
export function outlineCanvas(src: HTMLCanvasElement, widthPx: number, color: string): { canvas: HTMLCanvasElement; pad: number } {
  const pad = Math.ceil(widthPx) + 2
  const out = makeCanvas(src.width + pad * 2, src.height + pad * 2)
  const ctx = out.getContext('2d')!
  if (widthPx <= 0) {
    ctx.drawImage(src, pad, pad)
    return { canvas: out, pad }
  }
  const sil = makeCanvas(src.width, src.height)
  const sctx = sil.getContext('2d')!
  sctx.drawImage(src, 0, 0)
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = color
  sctx.fillRect(0, 0, sil.width, sil.height)
  const steps = Math.max(16, Math.ceil(widthPx * 2.5))
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    ctx.drawImage(sil, pad + Math.cos(a) * widthPx, pad + Math.sin(a) * widthPx)
  }
  // Rellena el interior para evitar huecos con contornos gruesos
  ctx.drawImage(sil, pad, pad)
  ctx.drawImage(src, pad, pad)
  return { canvas: out, pad }
}

/**
 * Prepara la imagen de una capa: aplica máscara (borrar/restaurar), recorte con forma
 * y contorno tipo sticker. El resultado se cachea fuera.
 */
export function processImageLayer(
  layer: ImageLayer,
  source: CanvasImageSource & { width: number; height: number },
  original: (CanvasImageSource & { width: number; height: number }) | null,
  maxScale = 2,
): ProcessedImage {
  const r = Math.max(0.25, Math.min(maxScale, source.width / Math.max(1, layer.width)))
  const w = layer.width * r
  const h = layer.height * r
  const base = makeCanvas(w, h)
  const ctx = base.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, base.width, base.height)

  if (layer.mask.length) {
    // Restaurar necesita la imagen original (antes de quitar el fondo)
    const orig = original ? makeCanvas(w, h) : null
    if (orig && original) orig.getContext('2d')!.drawImage(original, 0, 0, orig.width, orig.height)
    for (const s of layer.mask) {
      if (s.points.length < 2) continue
      if (s.mode === 'erase') {
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        strokePath(ctx, s.points, s.size, r)
        ctx.restore()
      } else if (orig) {
        const tmp = makeCanvas(w, h)
        const t = tmp.getContext('2d')!
        strokePath(t, s.points, s.size, r)
        t.globalCompositeOperation = 'source-in'
        t.drawImage(orig, 0, 0)
        ctx.drawImage(tmp, 0, 0)
      }
    }
  }

  let working = base
  const path = cropPath(layer.crop.shape, w, h, layer.crop.radius, layer.crop.points.map((v) => v * r))
  if (path) {
    const clipped = makeCanvas(w, h)
    const c = clipped.getContext('2d')!
    c.save()
    c.clip(path)
    c.drawImage(base, 0, 0)
    c.restore()
    working = clipped
  }

  const { canvas, pad } = outlineCanvas(working, layer.outline.width * r, layer.outline.color)
  return { canvas, pad: pad / r }
}

function strokePath(ctx: CanvasRenderingContext2D, pts: number[], size: number, r: number) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * r
  ctx.strokeStyle = '#000'
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.moveTo(pts[0] * r, pts[1] * r)
  if (pts.length === 2) {
    ctx.arc(pts[0] * r, pts[1] * r, (size * r) / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * r, pts[i + 1] * r)
  ctx.stroke()
}

/** Clave de caché con todo lo que afecta al resultado procesado. */
export function processKey(layer: ImageLayer, frameAsset: string): string {
  return JSON.stringify([frameAsset, layer.originalAssetId, layer.width, layer.height, layer.crop, layer.outline, layer.mask.length, layer.mask.at(-1)?.points.length ?? 0])
}
