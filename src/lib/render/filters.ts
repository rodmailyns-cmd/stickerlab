import type { FilterSettings } from '@/types/doc'

/** Ajustes extra que vienen de las animaciones (arcoíris, brillo). */
export interface FilterExtras {
  hue: number
  brightness: number
}

export function isDefaultFilters(f: FilterSettings): boolean {
  return (
    f.brightness === 0 &&
    f.contrast === 0 &&
    f.saturation === 0 &&
    !f.grayscale &&
    !f.popArt &&
    f.pixelate <= 1 &&
    f.vignette === 0 &&
    f.glitch === 0
  )
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/** Matriz de rotación de tono (aprox. de feColorMatrix hueRotate). */
function hueMatrix(deg: number): number[] {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ]
}

function pixelate(img: ImageData, size: number) {
  const { width: w, height: h, data } = img
  const s = Math.max(2, Math.round(size))
  for (let by = 0; by < h; by += s) {
    for (let bx = 0; bx < w; bx += s) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      const ey = Math.min(by + s, h)
      const ex = Math.min(bx + s, w)
      for (let y = by; y < ey; y++) {
        for (let x = bx; x < ex; x++) {
          const i = (y * w + x) * 4
          r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3]; n++
        }
      }
      r /= n; g /= n; b /= n; a /= n
      for (let y = by; y < ey; y++) {
        for (let x = bx; x < ex; x++) {
          const i = (y * w + x) * 4
          data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a
        }
      }
    }
  }
}

function glitch(img: ImageData, amount: number, seed: number) {
  const { width: w, height: h, data } = img
  const src = new Uint8ClampedArray(data)
  const shift = Math.round(amount * w * 0.03)
  let s = seed | 0 || 7
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  // Separación RGB
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const xr = Math.min(w - 1, x + shift)
      const xb = Math.max(0, x - shift)
      data[i] = src[(y * w + xr) * 4]
      data[i + 2] = src[(y * w + xb) * 4 + 2]
      data[i + 3] = Math.max(src[i + 3], src[(y * w + xr) * 4 + 3], src[(y * w + xb) * 4 + 3])
    }
  }
  // Franjas desplazadas
  const slices = Math.round(3 + amount * 8)
  const copy = new Uint8ClampedArray(data)
  for (let k = 0; k < slices; k++) {
    const y0 = Math.floor(rnd() * h)
    const sh = Math.max(2, Math.floor(rnd() * h * 0.04))
    const off = Math.round((rnd() - 0.5) * w * 0.12 * amount)
    for (let y = y0; y < Math.min(h, y0 + sh); y++) {
      for (let x = 0; x < w; x++) {
        const sx = Math.min(w - 1, Math.max(0, x - off))
        const di = (y * w + x) * 4
        const si = (y * w + sx) * 4
        data[di] = copy[si]; data[di + 1] = copy[si + 1]; data[di + 2] = copy[si + 2]; data[di + 3] = copy[si + 3]
      }
    }
  }
}

/** Aplica todos los ajustes a un ImageData (en el sitio). Funciona igual en el editor y al exportar. */
export function applyFilters(img: ImageData, f: FilterSettings, extra: FilterExtras = { hue: 0, brightness: 0 }, seed = 1): void {
  const { data, width: w, height: h } = img
  const bright = (f.brightness + extra.brightness) * 255
  const c = f.contrast * 2.55
  const cf = (259 * (c + 255)) / (255 * (259 - c))
  const sat = 1 + f.saturation
  const hue = extra.hue % 360
  const hm = hue ? hueMatrix(hue) : null
  const vig = f.vignette
  const cx = w / 2
  const cy = h / 2
  const maxD = Math.sqrt(cx * cx + cy * cy)
  const doColor = bright !== 0 || c !== 0 || sat !== 1 || hm || f.grayscale || f.popArt || vig > 0

  if (doColor) {
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      if (data[i + 3] === 0) continue
      let r = data[i], g = data[i + 1], b = data[i + 2]
      if (bright) { r += bright; g += bright; b += bright }
      if (c) { r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128 }
      if (sat !== 1 || f.popArt) {
        const s2 = f.popArt ? Math.max(sat, 1.8) : sat
        const l = 0.299 * r + 0.587 * g + 0.114 * b
        r = l + (r - l) * s2; g = l + (g - l) * s2; b = l + (b - l) * s2
      }
      if (hm) {
        const nr = r * hm[0] + g * hm[1] + b * hm[2]
        const ng = r * hm[3] + g * hm[4] + b * hm[5]
        const nb = r * hm[6] + g * hm[7] + b * hm[8]
        r = nr; g = ng; b = nb
      }
      if (f.grayscale) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b
        r = g = b = l
      }
      if (f.popArt) {
        const q = 255 / 3
        r = Math.round(clamp(r) / q) * q; g = Math.round(clamp(g) / q) * q; b = Math.round(clamp(b) / q) * q
      }
      if (vig > 0) {
        const x = p % w
        const y = (p / w) | 0
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxD
        const k = 1 - vig * Math.pow(Math.max(0, d - 0.35) / 0.65, 1.6)
        r *= k; g *= k; b *= k
      }
      data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b)
    }
  }
  if (f.pixelate > 1) pixelate(img, f.pixelate * (w / 512))
  if (f.glitch > 0) glitch(img, f.glitch, seed)
}

/** Lista de filtros rápidos para la interfaz. */
export const FILTER_PRESETS: { id: string; label: string; settings: Partial<FilterSettings> }[] = [
  { id: 'none', label: 'Original', settings: {} },
  { id: 'vivid', label: 'Vívido', settings: { saturation: 0.5, contrast: 15 } },
  { id: 'bw', label: 'B/N', settings: { grayscale: true, contrast: 20 } },
  { id: 'pop', label: 'Pop-art', settings: { popArt: true } },
  { id: 'pixel', label: 'Píxel', settings: { pixelate: 10 } },
  { id: 'vignette', label: 'Viñeta', settings: { vignette: 0.7 } },
  { id: 'glitch', label: 'Glitch', settings: { glitch: 0.6 } },
  { id: 'soft', label: 'Suave', settings: { brightness: 0.08, contrast: -15, saturation: -0.2 } },
]
