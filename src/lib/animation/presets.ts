import type { AnimationPresetId, Keyframe, Layer, LayerAnimation } from '@/types/doc'

/** Desplazamientos que una animación aplica sobre la pose base de una capa. */
export interface AnimDelta {
  dx: number
  dy: number
  rotation: number
  scaleX: number
  scaleY: number
  opacity: number
  /** Rotación de tono en grados (arcoíris). */
  hue: number
  /** Brillo extra -1..1 (destello). */
  brightness: number
}

export const IDENTITY: AnimDelta = { dx: 0, dy: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, hue: 0, brightness: 0 }

export interface PresetInfo {
  id: AnimationPresetId
  label: string
  emoji: string
  /** Ciclos por segundo con velocidad 1. */
  baseHz: number
}

export const PRESETS: PresetInfo[] = [
  { id: 'bounce', label: 'Rebote', emoji: '🏀', baseHz: 1.5 },
  { id: 'heartbeat', label: 'Latido', emoji: '💓', baseHz: 1.2 },
  { id: 'spin', label: 'Giro', emoji: '🌀', baseHz: 0.5 },
  { id: 'shake', label: 'Temblor', emoji: '🫨', baseHz: 6 },
  { id: 'float', label: 'Flotar', emoji: '🎈', baseHz: 0.6 },
  { id: 'appear', label: 'Aparecer', emoji: '✨', baseHz: 0.5 },
  { id: 'shine', label: 'Brillo', emoji: '🌟', baseHz: 1 },
  { id: 'rainbow', label: 'Arcoíris', emoji: '🌈', baseHz: 0.5 },
  { id: 'zoom', label: 'Zoom', emoji: '🔍', baseHz: 1 },
  { id: 'pendulum', label: 'Péndulo', emoji: '🕰️', baseHz: 0.8 },
]

export function presetInfo(id: AnimationPresetId): PresetInfo {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}

/**
 * Número de ciclos completos dentro de la duración. Siempre entero para que
 * el bucle del sticker sea perfecto (el último fotograma enlaza con el primero).
 */
export function cyclesFor(anim: LayerAnimation, duration: number): number {
  const hz = presetInfo(anim.preset).baseHz * anim.speed
  return Math.max(1, Math.round(hz * duration))
}

const TAU = Math.PI * 2

function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/** Evalúa una animación en el instante `t` (s). `h` es la altura de la capa (para el péndulo). */
export function evalPreset(anim: LayerAnimation, t: number, duration: number, h: number): AnimDelta {
  const k = anim.intensity
  const cycles = cyclesFor(anim, duration)
  const p = duration > 0 ? (((t / duration) * cycles) % 1 + 1) % 1 : 0
  const s = Math.sin(p * TAU)
  const d: AnimDelta = { ...IDENTITY }
  switch (anim.preset) {
    case 'bounce': {
      const up = Math.abs(Math.sin(p * Math.PI))
      d.dy = -up * 60 * k
      const squash = Math.max(0, 1 - up * 4) * 0.18 * k
      d.scaleX = 1 + squash
      d.scaleY = 1 - squash
      break
    }
    case 'heartbeat': {
      const beat = (x: number, c: number) => Math.exp(-Math.pow((x - c) / 0.06, 2))
      const v = beat(p, 0.15) + 0.7 * beat(p, 0.38)
      d.scaleX = d.scaleY = 1 + v * 0.22 * k
      break
    }
    case 'spin':
      d.rotation = p * 360 * (k >= 0 ? 1 : -1)
      break
    case 'shake': {
      d.dx = Math.sin(p * TAU) * 8 * k
      d.dy = Math.sin(p * TAU * 2 + 1) * 3 * k
      d.rotation = Math.sin(p * TAU + 0.5) * 4 * k
      break
    }
    case 'float':
      d.dy = s * 18 * k
      d.rotation = Math.sin(p * TAU + Math.PI / 2) * 3 * k
      break
    case 'appear': {
      // Entra con un salto, se mantiene y se desvanece al final del ciclo
      const inT = Math.min(1, p / 0.3)
      const out = p > 0.85 ? (p - 0.85) / 0.15 : 0
      const sc = easeOutBack(inT)
      d.scaleX = d.scaleY = Math.max(0.01, sc * (1 - out * 0.3))
      d.opacity = Math.min(1, inT * 1.5) * (1 - out)
      break
    }
    case 'shine': {
      d.brightness = Math.max(0, Math.sin(p * TAU)) * 0.35 * k
      d.scaleX = d.scaleY = 1 + Math.max(0, s) * 0.04 * k
      break
    }
    case 'rainbow':
      d.hue = p * 360
      break
    case 'zoom':
      d.scaleX = d.scaleY = 1 + s * 0.25 * k
      break
    case 'pendulum': {
      const angle = s * 20 * k
      d.rotation = angle
      // Pivote en el borde superior: compensa la traslación del centro
      const rad = (angle * Math.PI) / 180
      const r = h / 2
      d.dx = -Math.sin(rad) * r
      d.dy = (Math.cos(rad) - 1) * r
      break
    }
  }
  return d
}

export function combineDeltas(a: AnimDelta, b: AnimDelta): AnimDelta {
  return {
    dx: a.dx + b.dx,
    dy: a.dy + b.dy,
    rotation: a.rotation + b.rotation,
    scaleX: a.scaleX * b.scaleX,
    scaleY: a.scaleY * b.scaleY,
    opacity: a.opacity * b.opacity,
    hue: a.hue + b.hue,
    brightness: a.brightness + b.brightness,
  }
}

function lerp(a: number, b: number, x: number) {
  return a + (b - a) * x
}

function smooth(x: number) {
  return x * x * (3 - 2 * x)
}

/** Interpola los keyframes de una capa. Devuelve null si no tiene. */
export function evalKeyframes(kfs: Keyframe[], t: number): Omit<Keyframe, 'id' | 't'> | null {
  if (!kfs.length) return null
  const sorted = [...kfs].sort((a, b) => a.t - b.t)
  if (t <= sorted[0].t) return sorted[0]
  const last = sorted[sorted.length - 1]
  if (t >= last.t) return last
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (t >= a.t && t <= b.t) {
      const x = smooth((t - a.t) / Math.max(1e-6, b.t - a.t))
      return {
        x: lerp(a.x, b.x, x),
        y: lerp(a.y, b.y, x),
        rotation: lerp(a.rotation, b.rotation, x),
        scale: lerp(a.scale, b.scale, x),
        opacity: lerp(a.opacity, b.opacity, x),
      }
    }
  }
  return last
}

export interface LayerPose {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  opacity: number
  hue: number
  brightness: number
  visible: boolean
}

/** Altura aproximada de una capa (para pivotes). */
export function layerHeight(layer: Layer): number {
  switch (layer.type) {
    case 'image':
    case 'shape':
      return layer.height * Math.abs(layer.scaleY)
    case 'text':
      return layer.fontSize * Math.abs(layer.scaleY)
    case 'emoji':
      return layer.size * Math.abs(layer.scaleY)
    case 'draw':
      return 512
  }
}

/** Pose final de una capa en el instante `t`. */
export function poseAt(layer: Layer, t: number | null, duration: number, includePresets = true): LayerPose {
  const base: LayerPose = {
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    opacity: layer.opacity,
    hue: 0,
    brightness: 0,
    visible: layer.visible,
  }
  if (t === null) return base
  if (layer.span && (t < layer.span.start || t >= layer.span.end)) base.visible = false
  const kf = evalKeyframes(layer.keyframes, t)
  if (kf) {
    const sx = Math.sign(layer.scaleX) || 1
    const sy = Math.sign(layer.scaleY) || 1
    base.x = kf.x
    base.y = kf.y
    base.rotation = kf.rotation
    base.scaleX = kf.scale * sx
    base.scaleY = kf.scale * sy
    base.opacity = kf.opacity
  }
  let delta = IDENTITY
  const h = layerHeight(layer)
  if (includePresets) for (const a of layer.animations) delta = combineDeltas(delta, evalPreset(a, t, duration, h))
  return {
    ...base,
    x: base.x + delta.dx,
    y: base.y + delta.dy,
    rotation: base.rotation + delta.rotation,
    scaleX: base.scaleX * delta.scaleX,
    scaleY: base.scaleY * delta.scaleY,
    opacity: Math.max(0, Math.min(1, base.opacity * delta.opacity)),
    hue: delta.hue,
    brightness: delta.brightness,
  }
}

/** Fotograma de una capa de imagen animada (GIF/vídeo) en el instante `t`. */
export function imageFrameAt(frames: { duration: number }[], t: number): number {
  const total = frames.reduce((a, f) => a + f.duration, 0)
  if (!total) return 0
  let ms = ((t * 1000) % total + total) % total
  for (let i = 0; i < frames.length; i++) {
    if (ms < frames[i].duration) return i
    ms -= frames[i].duration
  }
  return frames.length - 1
}

/** ¿El documento tiene algo que se mueva? */
export function docHasMotion(layers: Layer[]): boolean {
  return layers.some(
    (l) => l.animations.length > 0 || l.keyframes.length > 1 || l.span !== null || (l.type === 'image' && (l.frames?.length ?? 0) > 1),
  )
}
