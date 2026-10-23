import { isNative } from '../native/platform'
import type { ImageFrame } from '@/types/doc'
import { createAsset } from '../render/assets'
import type { ImageWorkerRequest, ImageWorkerResponse, WorkerFrame } from '@/workers/image.worker'

export interface ImportedMedia {
  assetId: string
  width: number
  height: number
  frames: ImageFrame[] | null
  durationMs: number
  name: string
}

export const MAX_IMAGE_SIZE = 1024
export const MAX_ANIM_FRAME_SIZE = 512
// En el móvil se limita más para no agotar la memoria en teléfonos de gama media
export const MAX_ANIM_FRAMES = isNative ? 90 : 150
export const MAX_ANIM_MS = 10_000

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (f: WorkerFrame[]) => void; reject: (e: Error) => void }>()

type DistOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

function callWorker(req: DistOmit<ImageWorkerRequest, 'id'>, transfer: Transferable[] = []): Promise<WorkerFrame[]> {
  if (!worker) {
    worker = new Worker(new URL('../../workers/image.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<ImageWorkerResponse>) => {
      const p = pending.get(ev.data.id)
      if (!p) return
      pending.delete(ev.data.id)
      if (ev.data.ok) p.resolve(ev.data.frames)
      else p.reject(new Error(ev.data.error))
    }
  }
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker!.postMessage({ ...req, id }, transfer)
  })
}

async function framesToMedia(frames: WorkerFrame[], name: string): Promise<ImportedMedia> {
  const assets = await Promise.all(frames.map((f) => createAsset(f.blob)))
  if (assets.length === 1) {
    return { assetId: assets[0].id, width: assets[0].width, height: assets[0].height, frames: null, durationMs: 0, name }
  }
  const imageFrames = assets.map((a, i) => ({ assetId: a.id, duration: frames[i].duration }))
  return {
    assetId: assets[0].id,
    width: assets[0].width,
    height: assets[0].height,
    frames: imageFrames,
    durationMs: imageFrames.reduce((a, f) => a + f.duration, 0),
    name,
  }
}

/** Importa una imagen o GIF (procesado en un web worker). */
export async function importImageFile(file: Blob, name = 'Imagen'): Promise<ImportedMedia> {
  if (file.type === 'image/gif') {
    const buffer = await file.arrayBuffer()
    const frames = await callWorker({ kind: 'gif', buffer, maxSize: MAX_ANIM_FRAME_SIZE, maxFrames: MAX_ANIM_FRAMES, maxMs: MAX_ANIM_MS }, [buffer])
    if (frames.length > 1) return framesToMedia(frames, name || 'GIF')
  }
  const frames = await callWorker({ kind: 'resize', blob: file, maxSize: MAX_IMAGE_SIZE })
  return framesToMedia(frames, name)
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done)
      resolve()
    }
    video.addEventListener('seeked', done)
    video.currentTime = t
  })
}

/** Extrae fotogramas de un vídeo entre `start` y `end` (s) a `fps`. */
export async function importVideoRange(
  video: HTMLVideoElement,
  start: number,
  end: number,
  fps: number,
  onProgress?: (p: number) => void,
): Promise<ImportedMedia> {
  const dur = Math.min(end - start, MAX_ANIM_MS / 1000)
  const count = Math.max(2, Math.min(MAX_ANIM_FRAMES, Math.round(dur * fps)))
  const step = dur / count
  const s = Math.min(1, MAX_ANIM_FRAME_SIZE / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * s)
  canvas.height = Math.round(video.videoHeight * s)
  const ctx = canvas.getContext('2d')!
  const frames: WorkerFrame[] = []
  video.pause()
  for (let i = 0; i < count; i++) {
    await seek(video, start + i * step)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/webp', 0.92))
    frames.push({ blob, width: canvas.width, height: canvas.height, duration: Math.round(step * 1000) })
    onProgress?.((i + 1) / count)
  }
  return framesToMedia(frames, 'Vídeo')
}

/** Captura un fotograma de la cámara. */
export async function captureFromVideo(video: HTMLVideoElement, mirror: boolean): Promise<ImportedMedia> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')!
  if (mirror) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(video, 0, 0)
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'))
  return importImageFile(blob, 'Foto')
}

export function isAcceptedFile(f: File): 'image' | 'video' | null {
  if (f.type.startsWith('image/')) return 'image'
  if (f.type.startsWith('video/')) return 'video'
  return null
}
