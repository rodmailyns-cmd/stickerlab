import Konva from 'konva'
import { CANVAS_SIZE, type FilterSettings, type Layer, type Shadow, type StickerDoc } from '@/types/doc'
import { imageFrameAt, poseAt } from '../animation/presets'
import { assetCache, type Drawable } from './assets'
import { applyFilters, isDefaultFilters, type FilterExtras } from './filters'
import { boldWeight, EMOJI_FONT, ensureFont, isFontReady } from './fonts'
import { outlineCanvas, processImageLayer, processKey, type ProcessedImage } from './imageProcess'
import { shapeById } from './shapes'

Konva.showWarnings = false

/** Filtro de Konva que delega en nuestra función pura (igual en editor y exportación). */
const stickerFilter = function (this: Konva.Node, imageData: ImageData) {
  const f = this.getAttr('slFilters') as FilterSettings | undefined
  const extra = this.getAttr('slExtras') as FilterExtras | undefined
  const seed = (this.getAttr('slSeed') as number | undefined) ?? 1
  if (f) applyFilters(imageData, f, extra, seed)
}

/** Filtro del contorno global tipo sticker sobre toda la composición. */
const globalOutlineFilter = function (this: Konva.Node, imageData: ImageData) {
  const cfg = this.getAttr('slOutline') as { width: number; color: string; shadow: Shadow; ratio: number } | undefined
  if (!cfg) return
  const src = document.createElement('canvas')
  src.width = imageData.width
  src.height = imageData.height
  src.getContext('2d')!.putImageData(imageData, 0, 0)
  const { canvas, pad } = outlineCanvas(src, cfg.width * cfg.ratio, cfg.color)
  const out = document.createElement('canvas')
  out.width = imageData.width
  out.height = imageData.height
  const ctx = out.getContext('2d')!
  if (cfg.shadow.enabled) {
    ctx.shadowColor = hexToRgba(cfg.shadow.color, cfg.shadow.opacity)
    ctx.shadowBlur = cfg.shadow.blur * cfg.ratio
    ctx.shadowOffsetX = cfg.shadow.offsetX * cfg.ratio
    ctx.shadowOffsetY = cfg.shadow.offsetY * cfg.ratio
  }
  ctx.drawImage(canvas, -pad, -pad)
  imageData.data.set(ctx.getImageData(0, 0, out.width, out.height).data)
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

function shadowAttrs(s: Shadow) {
  return {
    shadowEnabled: s.enabled,
    shadowColor: s.color,
    shadowBlur: s.blur,
    shadowOffsetX: s.offsetX,
    shadowOffsetY: s.offsetY,
    shadowOpacity: s.opacity,
  }
}

interface Entry {
  group: Konva.Group
  content: Konva.Group | Konva.Shape | null
  layer: Layer | null
  contentKey: string
  cacheKey: string
}

export interface RenderParams {
  /** Tiempo para las poses (null = pose base, sin animación). */
  t: number | null
  /** Tiempo para elegir fotogramas de GIF/vídeo. */
  frameTime: number
  /** En modo edición no se aplican las animaciones prediseñadas. */
  mode: 'edit' | 'play' | 'export'
}

const LRU_MAX = 120

export class SceneRenderer {
  readonly stage: Konva.Stage
  readonly content: Konva.Layer
  readonly scene: Konva.Group
  readonly ui: Konva.Layer | null
  private entries = new Map<string, Entry>()
  private processed = new Map<string, ProcessedImage>()
  private last: { doc: StickerDoc; params: RenderParams } | null = null
  private displaySize: number
  private unsub: () => void
  onAfterRender: (() => void) | null = null

  constructor(container: HTMLDivElement, displaySize: number, interactive: boolean) {
    this.displaySize = displaySize
    this.stage = new Konva.Stage({ container, width: displaySize, height: displaySize })
    this.content = new Konva.Layer({ listening: interactive })
    this.scene = new Konva.Group({ clipX: 0, clipY: 0, clipWidth: CANVAS_SIZE, clipHeight: CANVAS_SIZE })
    this.content.add(this.scene)
    this.stage.add(this.content)
    this.ui = interactive ? new Konva.Layer() : null
    if (this.ui) this.stage.add(this.ui)
    this.applyScale()
    this.unsub = assetCache.onLoad(() => this.rerender())
  }

  private applyScale() {
    const s = this.displaySize / CANVAS_SIZE
    this.stage.size({ width: this.displaySize, height: this.displaySize })
    this.stage.scale({ x: s, y: s })
  }

  /** Relación de píxeles para las cachés (nitidez en pantallas grandes / retina). */
  get cacheRatio(): number {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    return this.ui ? Math.max(1, (this.displaySize / CANVAS_SIZE) * dpr) : 1
  }

  setDisplaySize(px: number) {
    if (px === this.displaySize || px <= 0) return
    this.displaySize = px
    this.applyScale()
    // Las cachés dependen de la escala
    this.entries.forEach((e) => (e.cacheKey = ''))
    this.rerender()
  }

  destroy() {
    this.unsub()
    this.stage.destroy()
    this.entries.clear()
    this.processed.clear()
  }

  groupFor(id: string): Konva.Group | undefined {
    return this.entries.get(id)?.group
  }

  rerender() {
    if (this.last) this.render(this.last.doc, this.last.params, true)
  }

  render(doc: StickerDoc, params: RenderParams, force = false) {
    this.last = { doc, params }
    const seen = new Set<string>()
    doc.layers.forEach((layer, index) => {
      seen.add(layer.id)
      let e = this.entries.get(layer.id)
      if (!e) {
        const group = new Konva.Group({ id: layer.id, name: 'sl-layer' })
        this.scene.add(group)
        e = { group, content: null, layer: null, contentKey: '', cacheKey: '' }
        this.entries.set(layer.id, e)
      }
      this.syncEntry(e, layer, doc, params, force)
      if (e.group.zIndex() !== index) e.group.zIndex(index)
    })
    for (const [id, e] of this.entries) {
      if (!seen.has(id)) {
        e.group.destroy()
        this.entries.delete(id)
      }
    }
    this.syncGlobalOutline(doc)
    this.content.batchDraw()
    this.onAfterRender?.()
  }

  /** Vuelve a cachear el contorno global (p. ej. mientras se arrastra una capa). */
  refreshSceneCache() {
    if (this.scene.isCached()) {
      this.scene.clearCache()
      this.scene.cache({ x: 0, y: 0, width: CANVAS_SIZE, height: CANVAS_SIZE, pixelRatio: this.cacheRatio })
      this.content.batchDraw()
    }
  }

  private syncGlobalOutline(doc: StickerDoc) {
    const o = doc.globalOutline
    if (o.width > 0 || o.shadow.enabled) {
      const ratio = this.cacheRatio
      this.scene.setAttr('slOutline', { width: o.width, color: o.color, shadow: o.shadow, ratio })
      this.scene.filters([globalOutlineFilter])
      this.scene.clearCache()
      this.scene.cache({ x: 0, y: 0, width: CANVAS_SIZE, height: CANVAS_SIZE, pixelRatio: ratio })
    } else if (this.scene.isCached()) {
      this.scene.clearCache()
      this.scene.filters([])
    }
  }

  private syncEntry(e: Entry, layer: Layer, doc: StickerDoc, params: RenderParams, force: boolean) {
    const { group } = e
    const playing = params.mode !== 'edit'
    const pose = poseAt(layer, params.t, doc.duration, playing)
    let visible = layer.visible
    let opacity = pose.opacity
    if (params.t !== null && !pose.visible && layer.visible) {
      if (params.mode === 'edit') opacity *= 0.25
      else visible = false
    }
    group.setAttrs({
      x: pose.x,
      y: pose.y,
      rotation: pose.rotation,
      scaleX: pose.scaleX,
      scaleY: pose.scaleY,
      opacity,
      visible,
      listening: !layer.locked,
    })
    if (!visible) {
      e.layer = layer
      return
    }

    // Contenido
    const frameAsset = layer.type === 'image' ? this.frameAssetId(layer, params.frameTime) : ''
    const fontReady = layer.type === 'text' ? isFontReady(layer.fontFamily, layer.bold, layer.italic) : true
    const contentKey = this.contentKeyFor(layer, frameAsset, fontReady)
    if (force || contentKey !== e.contentKey || !e.content) {
      e.content?.destroy()
      e.content = this.buildContent(layer, frameAsset)
      if (e.content) group.add(e.content)
      e.contentKey = contentKey
      e.cacheKey = ''
      if (layer.type === 'text' && !fontReady) {
        void ensureFont(layer.fontFamily, layer.bold, layer.italic).then((ok) => ok && this.rerender())
      }
    }
    e.layer = layer

    // Filtros, mezcla y caché
    const hue = Math.round(pose.hue)
    const brightness = Math.round(pose.brightness * 100) / 100
    const filtersOn = !isDefaultFilters(layer.filters) || hue !== 0 || brightness !== 0
    const hasEraser = layer.type === 'draw' && layer.lines.some((l) => l.mode === 'eraser')
    const needsCache = filtersOn || hasEraser
    const seed = layer.filters.glitch > 0 && playing && params.t !== null ? Math.floor(params.t * 12) + 1 : 1
    if (e.content instanceof Konva.Shape) e.content.globalCompositeOperation(needsCache ? 'source-over' : layer.blend)
    group.globalCompositeOperation(needsCache ? layer.blend : 'source-over')
    const cacheKey = needsCache ? `${contentKey}|${JSON.stringify(layer.filters)}|${hue}|${brightness}|${seed}|${this.displaySize}` : ''
    if (cacheKey !== e.cacheKey) {
      group.clearCache()
      if (needsCache && e.content) {
        group.setAttrs({ slFilters: layer.filters, slExtras: { hue, brightness }, slSeed: seed })
        group.filters(filtersOn ? [stickerFilter] : [])
        const rect = group.getClientRect({ skipTransform: true })
        if (rect.width > 0 && rect.height > 0) {
          group.cache({ pixelRatio: this.cacheRatio, offset: 2 })
        }
      } else {
        group.filters([])
      }
      e.cacheKey = cacheKey
    }
  }

  private frameAssetId(layer: Extract<Layer, { type: 'image' }>, frameTime: number): string {
    if (layer.frames && layer.frames.length) return layer.frames[imageFrameAt(layer.frames, frameTime)].assetId
    return layer.assetId
  }

  private restKeys = new WeakMap<Layer, string>()

  private contentKeyFor(layer: Layer, frameAsset: string, fontReady: boolean): string {
    let restKey = this.restKeys.get(layer)
    const loaded = layer.type === 'image' ? assetCache.has(frameAsset) : true
    if (restKey === undefined) {
      restKey = this.restKeyFor(layer)
      this.restKeys.set(layer, restKey)
    }
    return `${restKey}|${frameAsset}|${fontReady}|${loaded}`
  }

  private restKeyFor(layer: Layer): string {
    const {
      id: _id, name: _n, x: _x, y: _y, rotation: _r, scaleX: _sx, scaleY: _sy, opacity: _o, visible: _v, locked: _l,
      animations: _a, keyframes: _k, span: _s, groupId: _g, filters: _f, blend: _b, ...rest
    } = layer
    return JSON.stringify(rest)
  }

  private buildContent(layer: Layer, frameAsset: string): Konva.Group | Konva.Shape | null {
    switch (layer.type) {
      case 'image': {
        const src = assetCache.get(frameAsset)
        if (!src) return null
        const needsProcess = layer.mask.length > 0 || layer.crop.shape !== 'none' || layer.outline.width > 0
        let image: Drawable | HTMLCanvasElement = src
        let pad = 0
        if (needsProcess) {
          const restore = layer.mask.some((m) => m.mode === 'restore')
          const orig = restore && layer.originalAssetId ? assetCache.get(layer.originalAssetId) : null
          const key = processKey(layer, frameAsset) + (orig ? '+o' : '')
          let p = this.processed.get(key)
          if (!p) {
            p = processImageLayer(layer, src, orig, layer.frames ? 1 : 2)
            this.processed.set(key, p)
            if (this.processed.size > LRU_MAX) this.processed.delete(this.processed.keys().next().value!)
          } else {
            // LRU: mover al final
            this.processed.delete(key)
            this.processed.set(key, p)
          }
          image = p.canvas
          pad = p.pad
        }
        const w = layer.width + pad * 2
        const h = layer.height + pad * 2
        return new Konva.Image({ image, width: w, height: h, offsetX: w / 2, offsetY: h / 2, ...shadowAttrs(layer.shadow) })
      }
      case 'text':
        return buildText(layer)
      case 'emoji': {
        const t = new Konva.Text({
          text: layer.emoji,
          fontSize: layer.size,
          fontFamily: EMOJI_FONT,
          lineHeight: 1.15,
          ...shadowAttrs(layer.shadow),
        })
        const r = t.getSelfRect()
        t.offset({ x: r.x + r.width / 2, y: r.y + r.height / 2 })
        return t
      }
      case 'shape': {
        const def = shapeById(layer.shape)
        const p = new Konva.Path({
          data: def.path,
          fill: layer.fill,
          stroke: layer.strokeWidth > 0 ? layer.stroke : undefined,
          strokeWidth: layer.strokeWidth,
          strokeScaleEnabled: false,
          lineJoin: 'round',
          fillRule: 'evenodd',
          scaleX: layer.width / 100,
          scaleY: layer.height / 100,
          offsetX: 50,
          offsetY: 50,
          ...shadowAttrs(layer.shadow),
        })
        return p
      }
      case 'draw': {
        const g = new Konva.Group({ offsetX: CANVAS_SIZE / 2, offsetY: CANVAS_SIZE / 2 })
        for (const line of layer.lines) {
          g.add(
            new Konva.Line({
              points: line.points.length === 2 ? [...line.points, line.points[0] + 0.1, line.points[1]] : line.points,
              stroke: line.color,
              strokeWidth: line.size,
              lineCap: 'round',
              lineJoin: 'round',
              tension: 0.4,
              globalCompositeOperation: line.mode === 'eraser' ? 'destination-out' : 'source-over',
            }),
          )
        }
        // Área invisible para poder seleccionar el dibujo haciendo clic sobre los trazos
        return g
      }
    }
  }

  /** Lienzo 512×512 con el fotograma actual (para exportar). */
  toCanvas(): HTMLCanvasElement {
    const ui = this.ui
    if (ui) ui.visible(false)
    const canvas = this.stage.toCanvas({ pixelRatio: CANVAS_SIZE / this.displaySize })
    if (ui) ui.visible(true)
    return canvas
  }
}

/** Construye un nodo de texto (recto o curvo) centrado en su origen. */
function buildText(layer: Extract<Layer, { type: 'text' }>): Konva.Shape {
  const fontStyle = `${layer.italic ? 'italic ' : ''}${layer.bold ? boldWeight(layer.fontFamily) : 'normal'}`
  const common = {
    text: layer.text,
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fontStyle,
    fill: layer.fill,
    stroke: layer.strokeWidth > 0 ? layer.stroke : undefined,
    strokeWidth: layer.strokeWidth,
    fillAfterStrokeEnabled: true,
    lineJoin: 'round' as const,
    letterSpacing: layer.letterSpacing,
    ...shadowAttrs(layer.shadow),
  }
  let node: Konva.Shape
  if (Math.abs(layer.curve) < 1 || layer.text.includes('\n')) {
    node = new Konva.Text({
      ...common,
      align: layer.align,
      lineHeight: layer.lineHeight,
      width: layer.width,
      padding: layer.strokeWidth / 2 + 2,
    })
  } else {
    node = buildCurvedText(layer, fontStyle, common)
  }
  const r = node.getSelfRect()
  node.offset({ x: r.x + r.width / 2, y: r.y + r.height / 2 })
  if (layer.gradient) {
    const a = (layer.gradient.angle * Math.PI) / 180
    const cx = r.x + r.width / 2
    const cy = r.y + r.height / 2
    const dx = (Math.cos(a) * r.width) / 2
    const dy = (Math.sin(a) * r.height) / 2
    node.setAttrs({
      fillPriority: 'linear-gradient',
      fillLinearGradientStartPoint: { x: cx - dx, y: cy - dy },
      fillLinearGradientEndPoint: { x: cx + dx, y: cy + dy },
      fillLinearGradientColorStops: [0, layer.gradient.from, 1, layer.gradient.to],
    })
  }
  return node
}

let measureCtx: CanvasRenderingContext2D | null = null

/**
 * Texto curvo: cada letra se coloca y gira sobre un arco de circunferencia.
 * Se dibuja dentro de una caja (0..w, 0..h) para que selección, caché y sombras funcionen.
 */
function buildCurvedText(layer: Extract<Layer, { type: 'text' }>, fontStyle: string, common: Record<string, unknown>): Konva.Shape {
  measureCtx ??= document.createElement('canvas').getContext('2d')!
  const font = `${fontStyle} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`
  measureCtx.font = font
  const chars = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(layer.text)].map((g) => g.segment)
  const widths = chars.map((c) => measureCtx!.measureText(c).width + layer.letterSpacing)
  const total = Math.max(1, widths.reduce((a, b) => a + b, 0))
  const theta = (Math.abs(layer.curve) / 100) * Math.PI * 1.8
  const R = total / theta
  const dir = layer.curve > 0 ? 1 : -1
  let acc = 0
  const glyphs = chars.map((c, i) => {
    const mid = acc + widths[i] / 2
    acc += widths[i]
    const ang = -theta / 2 + mid / R
    return { c, x: R * Math.sin(ang), y: dir * (R - R * Math.cos(ang)), rot: dir * ang }
  })
  const pad = layer.fontSize * 0.75 + layer.strokeWidth
  const minX = Math.min(...glyphs.map((g) => g.x)) - pad
  const maxX = Math.max(...glyphs.map((g) => g.x)) + pad
  const minY = Math.min(...glyphs.map((g) => g.y)) - pad
  const maxY = Math.max(...glyphs.map((g) => g.y)) + pad
  const w = maxX - minX
  const h = maxY - minY
  const gradient = layer.gradient
  return new Konva.Shape({
    ...common,
    shadowEnabled: false,
    width: w,
    height: h,
    sceneFunc(context, shape) {
      const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context
      ctx.font = font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.lineWidth = layer.strokeWidth
      ctx.strokeStyle = layer.stroke
      // Puntos del degradado en coordenadas de la caja
      const ga = gradient ? (gradient.angle * Math.PI) / 180 : 0
      const g0 = { x: w / 2 - (Math.cos(ga) * w) / 2, y: h / 2 - (Math.sin(ga) * h) / 2 }
      const g1 = { x: w / 2 + (Math.cos(ga) * w) / 2, y: h / 2 + (Math.sin(ga) * h) / 2 }
      const m = ctx.getTransform()
      const px = Math.hypot(m.a, m.b)
      const sh = layer.shadow
      for (const gl of glyphs) {
        ctx.save()
        const tx = gl.x - minX
        const ty = gl.y - minY
        ctx.translate(tx, ty)
        ctx.rotate(gl.rot)
        if (gradient) {
          // El degradado se define en el espacio local de cada letra
          const toLocal = (p: { x: number; y: number }) => {
            const dx = p.x - tx
            const dy = p.y - ty
            const c = Math.cos(-gl.rot)
            const s2 = Math.sin(-gl.rot)
            return { x: dx * c - dy * s2, y: dx * s2 + dy * c }
          }
          const a0 = toLocal(g0)
          const a1 = toLocal(g1)
          const g = ctx.createLinearGradient(a0.x, a0.y, a1.x, a1.y)
          g.addColorStop(0, gradient.from)
          g.addColorStop(1, gradient.to)
          ctx.fillStyle = g
        } else ctx.fillStyle = layer.fill
        if (sh.enabled) {
          ctx.shadowColor = hexToRgba(sh.color, sh.opacity)
          ctx.shadowBlur = sh.blur * px
          ctx.shadowOffsetX = sh.offsetX * px
          ctx.shadowOffsetY = sh.offsetY * px
        }
        if (layer.strokeWidth > 0) {
          ctx.strokeText(gl.c, 0, 0)
          // Sin sombra en el relleno para que no se duplique sobre el contorno
          ctx.shadowColor = 'transparent'
        }
        ctx.fillText(gl.c, 0, 0)
        ctx.restore()
      }
      void shape
    },
    hitFunc(context, shape) {
      context.beginPath()
      context.rect(0, 0, w, h)
      context.closePath()
      context.fillStrokeShape(shape)
    },
  })
}
