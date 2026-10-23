import fs from 'node:fs'
import path from 'node:path'
import encode, { init } from '@jsquash/webp/encode'

let ready: Promise<unknown> | null = null

/** Inicializa libwebp (WASM) en Node para las pruebas. */
export async function encodeWebP(img: { data: Uint8ClampedArray; width: number; height: number }, quality = 75): Promise<Uint8Array> {
  if (!ready) {
    const wasmPath = path.resolve('node_modules/@jsquash/webp/codec/enc/webp_enc_simd.wasm')
    ready = WebAssembly.compile(fs.readFileSync(wasmPath)).then((m) => init(m))
  }
  await ready
  const buf = await encode(img as unknown as ImageData, { quality })
  return new Uint8Array(buf)
}

/** Imagen de prueba con ruido para que no comprima trivialmente. */
export function makeImage(width: number, height: number, seed = 1, alpha = true) {
  const data = new Uint8ClampedArray(width * height * 4)
  let s = seed
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const inside = !alpha || (x - width / 2) ** 2 + (y - height / 2) ** 2 < (width / 2.2) ** 2
      data[i] = (x * 2 + seed * 40) % 256
      data[i + 1] = (y * 3 + rnd() * 60) % 256
      data[i + 2] = (rnd() * 255) | 0
      data[i + 3] = inside ? 255 : 0
    }
  }
  return { data, width, height }
}
