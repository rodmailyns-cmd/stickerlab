import encode from '@jsquash/webp/encode'
import { posterize } from '../lib/export/optimizer'

export interface EncodeRequest {
  id: number
  width: number
  height: number
  buffer: ArrayBuffer
  quality: number
  colors: number
}

export type EncodeResponse = { id: number; ok: true; data: ArrayBuffer } | { id: number; ok: false; error: string }

self.onmessage = async (ev: MessageEvent<EncodeRequest>) => {
  const { id, width, height, buffer, quality, colors } = ev.data
  try {
    const data = new Uint8ClampedArray(buffer)
    if (colors > 0) posterize(data, colors)
    const out = await encode({ data, width, height, colorSpace: 'srgb' } as ImageData, {
      quality,
      method: 4,
      alpha_quality: Math.max(60, Math.min(100, quality + 20)),
      exact: 0,
      use_sharp_yuv: quality >= 70 ? 1 : 0,
    })
    ;(self as unknown as Worker).postMessage({ id, ok: true, data: out } satisfies EncodeResponse, [out])
  } catch (e) {
    ;(self as unknown as Worker).postMessage({ id, ok: false, error: String(e) } satisfies EncodeResponse)
  }
}
