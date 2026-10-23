/** Fuentes (de Google Fonts, servidas localmente) disponibles en el editor. */
export interface FontDef {
  family: string
  category: 'divertida' | 'meme' | 'manuscrita' | 'elegante' | 'retro' | 'básica'
  /** Pesos disponibles (para pedir solo lo necesario). */
  weights: number[]
  italic?: boolean
}

export const FONTS: FontDef[] = [
  { family: 'Nunito', category: 'básica', weights: [400, 800, 900], italic: true },
  { family: 'Poppins', category: 'básica', weights: [400, 700, 900], italic: true },
  { family: 'Fredoka', category: 'divertida', weights: [400, 700] },
  { family: 'Baloo 2', category: 'divertida', weights: [400, 800] },
  { family: 'Chewy', category: 'divertida', weights: [400] },
  { family: 'Sniglet', category: 'divertida', weights: [400, 800] },
  { family: 'Titan One', category: 'divertida', weights: [400] },
  { family: 'Lilita One', category: 'divertida', weights: [400] },
  { family: 'Luckiest Guy', category: 'divertida', weights: [400] },
  { family: 'Rubik Bubbles', category: 'divertida', weights: [400] },
  { family: 'Anton', category: 'meme', weights: [400] },
  { family: 'Bangers', category: 'meme', weights: [400] },
  { family: 'Bebas Neue', category: 'meme', weights: [400] },
  { family: 'Archivo Black', category: 'meme', weights: [400] },
  { family: 'Oswald', category: 'meme', weights: [400, 700] },
  { family: 'Sigmar One', category: 'meme', weights: [400] },
  { family: 'Permanent Marker', category: 'manuscrita', weights: [400] },
  { family: 'Caveat', category: 'manuscrita', weights: [400, 700] },
  { family: 'Gloria Hallelujah', category: 'manuscrita', weights: [400] },
  { family: 'Indie Flower', category: 'manuscrita', weights: [400] },
  { family: 'Patrick Hand', category: 'manuscrita', weights: [400] },
  { family: 'Gochi Hand', category: 'manuscrita', weights: [400] },
  { family: 'Amatic SC', category: 'manuscrita', weights: [400, 700] },
  { family: 'Pacifico', category: 'elegante', weights: [400] },
  { family: 'Lobster', category: 'elegante', weights: [400] },
  { family: 'Dancing Script', category: 'elegante', weights: [400, 700] },
  { family: 'Shrikhand', category: 'elegante', weights: [400] },
  { family: 'Righteous', category: 'retro', weights: [400] },
  { family: 'Press Start 2P', category: 'retro', weights: [400] },
  { family: 'Monoton', category: 'retro', weights: [400] },
  { family: 'Bungee', category: 'retro', weights: [400] },
  { family: 'Creepster', category: 'retro', weights: [400] },
  { family: 'Black Ops One', category: 'retro', weights: [400] },
  { family: 'Montserrat', category: 'básica', weights: [400, 800, 900], italic: true },
  { family: 'Quicksand', category: 'básica', weights: [400, 700] },
]

const requested = new Set<string>()
const loaded = new Set<string>()

/** CSS local de la familia (copiado de @fontsource por scripts/copy-fonts.mjs): funciona sin internet. */
function cssUrl(f: FontDef): string {
  return `${import.meta.env.BASE_URL}fonts/${f.family.toLowerCase().replace(/ /g, '-')}.css`
}

export function fontDef(family: string): FontDef | undefined {
  return FONTS.find((f) => f.family === family)
}

/** Carga una fuente del catálogo y espera a que esté lista para el lienzo. */
export async function ensureFont(family: string, bold = false, italic = false): Promise<boolean> {
  const def = fontDef(family)
  if (!def) return true
  if (!requested.has(family)) {
    requested.add(family)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = cssUrl(def)
    document.head.appendChild(link)
  }
  const key = `${family}|${bold}|${italic}`
  if (loaded.has(key)) return true
  const weight = bold ? Math.max(...def.weights) : def.weights[0]
  try {
    await Promise.race([
      document.fonts.load(`${italic ? 'italic ' : ''}${weight} 48px "${family}"`, 'AaÑñ'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ])
    loaded.add(key)
    return true
  } catch {
    return false
  }
}

export function isFontReady(family: string, bold = false, italic = false) {
  return !fontDef(family) || loaded.has(`${family}|${bold}|${italic}`)
}

/** Peso real a usar en el lienzo para "negrita". */
export function boldWeight(family: string): number {
  const def = fontDef(family)
  return def ? Math.max(...def.weights) : 700
}

export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif'
