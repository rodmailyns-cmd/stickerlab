/**
 * Utilidades para el contenedor RIFF de WebP: leer información y montar
 * WebP animados a partir de fotogramas WebP estáticos (codificados con libwebp).
 * Especificación: https://developers.google.com/speed/webp/docs/riff_container
 */

export interface RiffChunk {
  fourcc: string
  /** Datos del chunk sin cabecera ni relleno. */
  data: Uint8Array
}

export interface WebPInfo {
  width: number
  height: number
  animated: boolean
  hasAlpha: boolean
  frameCount: number
  /** Duración total en ms (0 si es estático). */
  durationMs: number
  loopCount: number
  frameDurations: number[]
}

const enc = new TextEncoder()
const dec = new TextDecoder('latin1')

function fourcc(bytes: Uint8Array, offset: number): string {
  return dec.decode(bytes.subarray(offset, offset + 4))
}

function u24(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)
}

function u32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
}

function writeU24(b: Uint8Array, o: number, v: number) {
  b[o] = v & 0xff
  b[o + 1] = (v >> 8) & 0xff
  b[o + 2] = (v >> 16) & 0xff
}

function writeU32(b: Uint8Array, o: number, v: number) {
  b[o] = v & 0xff
  b[o + 1] = (v >> 8) & 0xff
  b[o + 2] = (v >> 16) & 0xff
  b[o + 3] = (v >>> 24) & 0xff
}

export function isWebP(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && fourcc(bytes, 0) === 'RIFF' && fourcc(bytes, 8) === 'WEBP'
}

/** Lee los chunks de primer nivel de un archivo WebP. */
export function readChunks(bytes: Uint8Array): RiffChunk[] {
  if (!isWebP(bytes)) throw new Error('No es un archivo WebP válido')
  return readChunkList(bytes, 12, bytes.length)
}

function readChunkList(bytes: Uint8Array, start: number, end: number): RiffChunk[] {
  const chunks: RiffChunk[] = []
  let o = start
  while (o + 8 <= end) {
    const id = fourcc(bytes, o)
    const size = u32(bytes, o + 4)
    const dataStart = o + 8
    if (dataStart + size > end) throw new Error(`Chunk ${id} truncado`)
    chunks.push({ fourcc: id, data: bytes.subarray(dataStart, dataStart + size) })
    o = dataStart + size + (size & 1)
  }
  return chunks
}

function vp8Dimensions(data: Uint8Array): { width: number; height: number } {
  // Fotograma clave VP8: 3 bytes de etiqueta + firma 9d 01 2a + ancho/alto de 14 bits
  if (data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a) throw new Error('Cabecera VP8 inválida')
  return { width: (data[6] | (data[7] << 8)) & 0x3fff, height: (data[8] | (data[9] << 8)) & 0x3fff }
}

function vp8lDimensions(data: Uint8Array): { width: number; height: number; alpha: boolean } {
  if (data[0] !== 0x2f) throw new Error('Firma VP8L inválida')
  const bits = u32(data, 1)
  return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, alpha: ((bits >> 28) & 1) === 1 }
}

export function getWebPInfo(bytes: Uint8Array): WebPInfo {
  const chunks = readChunks(bytes)
  const first = chunks[0]
  if (!first) throw new Error('WebP vacío')
  if (first.fourcc === 'VP8 ') {
    const d = vp8Dimensions(first.data)
    return { ...d, animated: false, hasAlpha: false, frameCount: 1, durationMs: 0, loopCount: 0, frameDurations: [] }
  }
  if (first.fourcc === 'VP8L') {
    const d = vp8lDimensions(first.data)
    return { width: d.width, height: d.height, animated: false, hasAlpha: d.alpha, frameCount: 1, durationMs: 0, loopCount: 0, frameDurations: [] }
  }
  if (first.fourcc !== 'VP8X') throw new Error(`Chunk inicial inesperado: ${first.fourcc}`)
  const flags = first.data[0]
  const animated = (flags & 0x02) !== 0
  const hasAlpha = (flags & 0x10) !== 0
  const width = u24(first.data, 4) + 1
  const height = u24(first.data, 7) + 1
  let loopCount = 0
  const frameDurations: number[] = []
  for (const c of chunks) {
    if (c.fourcc === 'ANIM') loopCount = c.data[4] | (c.data[5] << 8)
    if (c.fourcc === 'ANMF') frameDurations.push(u24(c.data, 12))
  }
  return {
    width,
    height,
    animated,
    hasAlpha,
    frameCount: animated ? frameDurations.length : 1,
    durationMs: frameDurations.reduce((a, b) => a + b, 0),
    loopCount,
    frameDurations,
  }
}

function chunkBytes(id: string, data: Uint8Array): Uint8Array {
  const pad = data.length & 1
  const out = new Uint8Array(8 + data.length + pad)
  out.set(enc.encode(id), 0)
  writeU32(out, 4, data.length)
  out.set(data, 8)
  return out
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** Extrae los chunks de bitstream (ALPH + VP8, o VP8L) de un WebP estático. */
export function extractFrameBitstream(bytes: Uint8Array): { chunks: Uint8Array[]; width: number; height: number; hasAlpha: boolean } {
  const chunks = readChunks(bytes)
  const info = getWebPInfo(bytes)
  if (info.animated) throw new Error('Se esperaba un WebP estático')
  const out: Uint8Array[] = []
  let hasAlpha = info.hasAlpha
  for (const c of chunks) {
    if (c.fourcc === 'ALPH' || c.fourcc === 'VP8 ' || c.fourcc === 'VP8L') {
      out.push(chunkBytes(c.fourcc, c.data))
      if (c.fourcc === 'ALPH') hasAlpha = true
      if (c.fourcc === 'VP8L' && vp8lDimensions(c.data).alpha) hasAlpha = true
    }
  }
  if (!out.length) throw new Error('El WebP no contiene datos de imagen')
  return { chunks: out, width: info.width, height: info.height, hasAlpha }
}

export interface AnimFrame {
  /** WebP estático codificado. */
  webp: Uint8Array
  /** Duración en ms (WhatsApp exige ≥ 8 ms). */
  duration: number
}

export interface MuxOptions {
  width: number
  height: number
  /** 0 = bucle infinito. */
  loopCount?: number
  backgroundColor?: [number, number, number, number]
}

/** Monta un WebP animado (VP8X + ANIM + ANMF…) a partir de fotogramas estáticos a tamaño completo. */
export function muxAnimatedWebP(frames: AnimFrame[], opts: MuxOptions): Uint8Array {
  if (!frames.length) throw new Error('No hay fotogramas')
  const { width, height } = opts
  const parts: Uint8Array[] = []
  let anyAlpha = false
  const anmfs: Uint8Array[] = []
  for (const f of frames) {
    const bs = extractFrameBitstream(f.webp)
    if (bs.width !== width || bs.height !== height) {
      throw new Error(`Fotograma de ${bs.width}×${bs.height}, se esperaba ${width}×${height}`)
    }
    anyAlpha ||= bs.hasAlpha
    const header = new Uint8Array(16)
    writeU24(header, 0, 0) // X / 2
    writeU24(header, 3, 0) // Y / 2
    writeU24(header, 6, width - 1)
    writeU24(header, 9, height - 1)
    writeU24(header, 12, Math.max(1, Math.min(0xffffff, Math.round(f.duration))))
    // bit1 = 1: no mezclar con el fotograma anterior; bit0 = 0: no desechar
    header[15] = 0x02
    anmfs.push(chunkBytes('ANMF', concat([header, ...bs.chunks])))
  }
  const vp8x = new Uint8Array(10)
  vp8x[0] = 0x02 | (anyAlpha ? 0x10 : 0)
  writeU24(vp8x, 4, width - 1)
  writeU24(vp8x, 7, height - 1)
  parts.push(chunkBytes('VP8X', vp8x))
  const anim = new Uint8Array(6)
  const [r, g, b, a] = opts.backgroundColor ?? [0, 0, 0, 0]
  // El color de fondo se guarda en orden B, G, R, A
  anim[0] = b
  anim[1] = g
  anim[2] = r
  anim[3] = a
  anim[4] = (opts.loopCount ?? 0) & 0xff
  anim[5] = ((opts.loopCount ?? 0) >> 8) & 0xff
  parts.push(chunkBytes('ANIM', anim))
  parts.push(...anmfs)
  const body = concat(parts)
  const out = new Uint8Array(12 + body.length)
  out.set(enc.encode('RIFF'), 0)
  writeU32(out, 4, 4 + body.length)
  out.set(enc.encode('WEBP'), 8)
  out.set(body, 12)
  return out
}
