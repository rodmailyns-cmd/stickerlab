/** Modelo de documento de StickerLab. Todo es serializable a JSON. */

export const CANVAS_SIZE = 512

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

export interface FilterSettings {
  brightness: number // -1..1
  contrast: number // -100..100
  saturation: number // -1..1
  grayscale: boolean
  popArt: boolean
  pixelate: number // 0 = off, tamaño de píxel
  vignette: number // 0..1
  glitch: number // 0..1
}

export const DEFAULT_FILTERS: FilterSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  grayscale: false,
  popArt: false,
  pixelate: 0,
  vignette: 0,
  glitch: 0,
}

export type AnimationPresetId =
  | 'bounce'
  | 'heartbeat'
  | 'spin'
  | 'shake'
  | 'float'
  | 'appear'
  | 'shine'
  | 'rainbow'
  | 'zoom'
  | 'pendulum'

export interface LayerAnimation {
  preset: AnimationPresetId
  /** Multiplicador de velocidad (ciclos por segundo base × speed). */
  speed: number
  /** 0..2, intensidad del efecto. */
  intensity: number
}

export interface Keyframe {
  id: string
  /** Tiempo en segundos. */
  t: number
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
}

export type CropShape = 'none' | 'circle' | 'rounded' | 'heart' | 'star' | 'lasso'

export interface Shadow {
  enabled: boolean
  color: string
  blur: number
  offsetX: number
  offsetY: number
  opacity: number
}

export const NO_SHADOW: Shadow = { enabled: false, color: '#000000', blur: 12, offsetX: 0, offsetY: 6, opacity: 0.35 }

export interface MaskStroke {
  mode: 'erase' | 'restore'
  size: number
  /** Puntos en coordenadas de la imagen procesada (px de la imagen fuente). */
  points: number[]
}

export interface LayerBase {
  id: string
  name: string
  /** Centro de la capa en el lienzo 512×512. */
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  opacity: number
  visible: boolean
  locked: boolean
  blend: BlendMode
  filters: FilterSettings
  animations: LayerAnimation[]
  keyframes: Keyframe[]
  /** Ventana de tiempo visible (segundos). null = siempre. */
  span: { start: number; end: number } | null
  groupId: string | null
}

export interface ImageFrame {
  assetId: string
  /** Duración del fotograma en ms. */
  duration: number
}

export interface ImageLayer extends LayerBase {
  type: 'image'
  assetId: string
  /** Original antes de quitar el fondo (para el pincel "restaurar"). */
  originalAssetId: string | null
  /** Si viene de GIF o vídeo: fotogramas animados. */
  frames: ImageFrame[] | null
  width: number
  height: number
  crop: { shape: CropShape; radius: number; points: number[] }
  outline: { width: number; color: string }
  shadow: Shadow
  mask: MaskStroke[]
}

export interface TextGradient {
  from: string
  to: string
  angle: number
}

export interface TextLayer extends LayerBase {
  type: 'text'
  text: string
  fontFamily: string
  fontSize: number
  bold: boolean
  italic: boolean
  fill: string
  gradient: TextGradient | null
  stroke: string
  strokeWidth: number
  shadow: Shadow
  /** -100..100, 0 = recto. */
  curve: number
  align: 'left' | 'center' | 'right'
  letterSpacing: number
  lineHeight: number
  width: number
}

export interface ShapeLayer extends LayerBase {
  type: 'shape'
  shape: string // id de la biblioteca de formas
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  shadow: Shadow
}

export interface EmojiLayer extends LayerBase {
  type: 'emoji'
  emoji: string
  size: number
  shadow: Shadow
}

export interface DrawLine {
  mode: 'brush' | 'eraser'
  color: string
  size: number
  points: number[]
}

export interface DrawLayer extends LayerBase {
  type: 'draw'
  lines: DrawLine[]
}

export type Layer = ImageLayer | TextLayer | ShapeLayer | EmojiLayer | DrawLayer
export type LayerType = Layer['type']

export interface StickerDoc {
  version: 1
  id: string
  name: string
  layers: Layer[]
  /** Fondo solo para vista previa; los stickers se exportan transparentes. */
  fps: number
  duration: number
  loop: boolean
  /** Si es true se exporta como sticker animado. */
  animated: boolean
  /** Contorno global tipo sticker alrededor de toda la composición. */
  globalOutline: { width: number; color: string; shadow: Shadow }
}

export interface Asset {
  id: string
  blob: Blob
  mime: string
  width: number
  height: number
}
