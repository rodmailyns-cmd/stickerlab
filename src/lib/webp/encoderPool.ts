import type { EncodeRequest, EncodeResponse } from '@/workers/encoder.worker'

/** Grupo de web workers que codifican WebP con libwebp (WASM) sin bloquear la interfaz. */
class EncoderPool {
  private workers: Worker[] = []
  private busy: boolean[] = []
  private queue: Array<{ req: Omit<EncodeRequest, 'id'>; resolve: (d: Uint8Array) => void; reject: (e: Error) => void }> = []
  private callbacks = new Map<number, { resolve: (d: Uint8Array) => void; reject: (e: Error) => void; worker: number }>()
  private nextId = 1

  private ensure() {
    if (this.workers.length) return
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1))
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('../../workers/encoder.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (ev: MessageEvent<EncodeResponse>) => {
        const cb = this.callbacks.get(ev.data.id)
        if (!cb) return
        this.callbacks.delete(ev.data.id)
        this.busy[cb.worker] = false
        if (ev.data.ok) cb.resolve(new Uint8Array(ev.data.data))
        else cb.reject(new Error(ev.data.error))
        this.pump()
      }
      this.workers.push(w)
      this.busy.push(false)
    }
  }

  private pump() {
    for (let i = 0; i < this.workers.length && this.queue.length; i++) {
      if (this.busy[i]) continue
      const job = this.queue.shift()!
      const id = this.nextId++
      this.busy[i] = true
      this.callbacks.set(id, { resolve: job.resolve, reject: job.reject, worker: i })
      this.workers[i].postMessage({ ...job.req, id }, [job.req.buffer])
    }
  }

  /** Codifica un ImageData. El buffer se transfiere (no reutilizar `img` después). */
  encode(img: ImageData, quality: number, colors = 0): Promise<Uint8Array> {
    this.ensure()
    return new Promise((resolve, reject) => {
      const buffer = img.data.buffer.slice(0) as ArrayBuffer
      this.queue.push({ req: { width: img.width, height: img.height, buffer, quality, colors }, resolve, reject })
      this.pump()
    })
  }
}

export const encoderPool = new EncoderPool()
