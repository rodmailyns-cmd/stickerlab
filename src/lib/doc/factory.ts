import { nanoid } from 'nanoid'
import {
  CANVAS_SIZE,
  DEFAULT_FILTERS,
  NO_SHADOW,
  type DrawLayer,
  type EmojiLayer,
  type ImageFrame,
  type ImageLayer,
  type LayerBase,
  type ShapeLayer,
  type StickerDoc,
  type TextLayer,
} from '@/types/doc'
import { shapeById } from '../render/shapes'

export const uid = () => nanoid(10)

export function newDoc(name = 'Mi sticker'): StickerDoc {
  return {
    version: 1,
    id: uid(),
    name,
    layers: [],
    fps: 15,
    duration: 2,
    loop: true,
    animated: false,
    globalOutline: { width: 0, color: '#ffffff', shadow: { ...NO_SHADOW } },
  }
}

export function baseLayer(name: string): LayerBase {
  return {
    id: uid(),
    name,
    x: CANVAS_SIZE / 2,
    y: CANVAS_SIZE / 2,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    visible: true,
    locked: false,
    blend: 'source-over',
    filters: { ...DEFAULT_FILTERS },
    animations: [],
    keyframes: [],
    span: null,
    groupId: null,
  }
}

/** Ajusta (w, h) para que quepa en `max` manteniendo la proporción. */
export function fitSize(w: number, h: number, max: number) {
  const s = max / Math.max(w, h)
  return { width: Math.round(w * s), height: Math.round(h * s) }
}

export function newImageLayer(assetId: string, w: number, h: number, frames: ImageFrame[] | null = null, name = 'Imagen'): ImageLayer {
  const size = fitSize(w, h, 440)
  return {
    ...baseLayer(name),
    type: 'image',
    assetId,
    originalAssetId: null,
    frames,
    ...size,
    crop: { shape: 'none', radius: 30, points: [] },
    outline: { width: 0, color: '#ffffff' },
    shadow: { ...NO_SHADOW },
    mask: [],
  }
}

export function newTextLayer(text = 'Hola', patch: Partial<TextLayer> = {}): TextLayer {
  return {
    ...baseLayer('Texto'),
    type: 'text',
    text,
    fontFamily: 'Fredoka',
    fontSize: 72,
    bold: true,
    italic: false,
    fill: '#ffffff',
    gradient: null,
    stroke: '#2b2d42',
    strokeWidth: 10,
    shadow: { ...NO_SHADOW },
    curve: 0,
    align: 'center',
    letterSpacing: 0,
    lineHeight: 1.05,
    width: 460,
    ...patch,
  }
}

export function newShapeLayer(shapeId: string, size = 200): ShapeLayer {
  const def = shapeById(shapeId)
  return {
    ...baseLayer(def.label),
    type: 'shape',
    shape: def.id,
    width: size,
    height: size,
    fill: def.fill,
    stroke: def.stroke,
    strokeWidth: def.strokeWidth,
    shadow: { ...NO_SHADOW },
  }
}

export function newEmojiLayer(emoji: string, size = 150): EmojiLayer {
  return { ...baseLayer(`Emoji ${emoji}`), type: 'emoji', emoji, size, shadow: { ...NO_SHADOW } }
}

export function newDrawLayer(): DrawLayer {
  return { ...baseLayer('Dibujo'), type: 'draw', lines: [] }
}

/** Copia profunda de una capa con IDs nuevos. */
export function cloneLayer<T extends LayerBase>(l: T, offset = 16): T {
  const c = structuredClone(l)
  c.id = uid()
  c.name = `${l.name} (copia)`
  c.x += offset
  c.y += offset
  c.keyframes = c.keyframes.map((k) => ({ ...k, id: uid(), x: k.x + offset, y: k.y + offset }))
  return c
}

/** Clona un documento completo (para duplicar stickers). */
export function cloneDoc(doc: StickerDoc, name?: string): StickerDoc {
  const d = structuredClone(doc)
  d.id = uid()
  if (name) d.name = name
  return d
}
