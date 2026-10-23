import { decompressFrames, parseGIF } from 'gifuct-js'

export type ImageWorkerRequest =
  | { id: number; kind: 'resize'; blob: Blob; maxSize: number }
  | { id: number; kind: 'gif'; buffer: ArrayBuffer; maxSize: number; maxFrames: number; maxMs: number }

export interface WorkerFrame {
  blob: Blob
  width: number
  height: number
  duration: number
}

export type ImageWorkerResponse =
  | { id: number; ok: true; frames: WorkerFrame[] }
  | { id: number; ok: false; error: string }

const post = (msg: ImageWorkerResponse) => (self as unknown as Worker).postMessage(msg)

function fit(w: number, h: number, max: number) {
  const s = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}

async function resize(blob: Blob, maxSize: number): Promise<WorkerFrame> {
  const bmp = await createImageBitmap(blob)
  const { w, h } = fit(bmp.width, bmp.height, maxSize)
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return { blob: await c.convertToBlob({ type: 'image/png' }), width: w, height: h, duration: 0 }
}

async function gif(buffer: ArrayBuffer, maxSize: number, maxFrames: number, maxMs: number): Promise<WorkerFrame[]> {
  const parsed = parseGIF(buffer)
  const frames = decompressFrames(parsed, true)
  const W = parsed.lsd.width
  const H = parsed.lsd.height
  const full = new OffscreenCanvas(W, H)
  const ctx = full.getContext('2d')!
  const patchCanvas = new OffscreenCanvas(1, 1)
  const pctx = patchCanvas.getContext('2d')!
  const { w, h } = fit(W, H, maxSize)
  const out: WorkerFrame[] = []
  let elapsed = 0
  let prevDisposal = 0
  let prevDims: { left: number; top: number; width: number; height: number } | null = null
  let restore: ImageData | null = null
  for (const f of frames) {
    if (out.length >= maxFrames || elapsed >= maxMs) break
    if (prevDims && prevDisposal === 2) ctx.clearRect(prevDims.left, prevDims.top, prevDims.width, prevDims.height)
    if (prevDisposal === 3 && restore) ctx.putImageData(restore, 0, 0)
    restore = f.disposalType === 3 ? ctx.getImageData(0, 0, W, H) : null
    const { width, height, left, top } = f.dims
    patchCanvas.width = width
    patchCanvas.height = height
    pctx.putImageData(new ImageData(new Uint8ClampedArray(f.patch), width, height), 0, 0)
    ctx.drawImage(patchCanvas, left, top)
    const snap = new OffscreenCanvas(w, h)
    const sctx = snap.getContext('2d')!
    sctx.drawImage(full, 0, 0, w, h)
    const duration = Math.max(20, f.delay || 100)
    out.push({ blob: await snap.convertToBlob({ type: 'image/png' }), width: w, height: h, duration })
    elapsed += duration
    prevDisposal = f.disposalType
    prevDims = f.dims
  }
  return out
}

self.onmessage = async (ev: MessageEvent<ImageWorkerRequest>) => {
  const req = ev.data
  try {
    if (req.kind === 'resize') post({ id: req.id, ok: true, frames: [await resize(req.blob, req.maxSize)] })
    else post({ id: req.id, ok: true, frames: await gif(req.buffer, req.maxSize, req.maxFrames, req.maxMs) })
  } catch (e) {
    post({ id: req.id, ok: false, error: String(e) })
  }
}
