import { create } from 'zustand'
import { haptic } from '@/lib/native/haptics'
import { assetCache } from '@/lib/render/assets'
import { docAssetIds } from '@/lib/storage/db'
import { produce, type Draft } from 'immer'
import type { Keyframe, Layer, StickerDoc } from '@/types/doc'
import { cloneLayer, newDoc, uid } from '@/lib/doc/factory'
import { docHasMotion, poseAt } from '@/lib/animation/presets'

export type Tool = 'select' | 'brush' | 'eraser' | 'mask-erase' | 'mask-restore' | 'lasso'

export type PanelId = 'import' | 'templates' | 'text' | 'elements' | 'draw' | 'cutout' | 'filters' | 'animate' | 'layers'

interface HistoryMeta {
  /** Cambios con la misma clave en menos de 900 ms se agrupan en un solo paso. */
  coalesce?: string
}

interface EditorState {
  doc: StickerDoc
  past: StickerDoc[]
  future: StickerDoc[]
  lastKey: string | null
  lastTime: number
  selection: string[]
  tool: Tool
  panel: PanelId
  brush: { color: string; size: number }
  maskBrush: number
  time: number
  playing: boolean
  /** ID del sticker de la biblioteca que se está editando (null = nuevo). */
  stickerId: string | null
  dirty: boolean

  setDoc: (recipe: (d: Draft<StickerDoc>) => void, meta?: HistoryMeta) => void
  loadDoc: (doc: StickerDoc, stickerId?: string | null) => void
  resetDoc: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  select: (ids: string[]) => void
  setTool: (t: Tool) => void
  setPanel: (p: PanelId) => void
  setBrush: (b: Partial<{ color: string; size: number }>) => void
  setMaskBrush: (n: number) => void
  setTime: (t: number) => void
  setPlaying: (p: boolean) => void
  markSaved: (stickerId: string) => void

  addLayer: (l: Layer, select?: boolean) => void
  updateLayer: <T extends Layer>(id: string, recipe: (l: Draft<T>) => void, meta?: HistoryMeta) => void
  updateSelected: (recipe: (l: Draft<Layer>) => void, meta?: HistoryMeta) => void
  removeLayers: (ids: string[]) => void
  duplicateLayers: (ids: string[]) => void
  moveLayer: (id: string, toIndex: number) => void
  shiftLayer: (id: string, delta: number) => void
  groupSelection: () => void
  ungroupSelection: () => void
  alignSelection: (how: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => void
  nudgeSelection: (dx: number, dy: number) => void
  /** Aplica una transformación: si la capa tiene keyframes, edita el del instante actual. */
  commitTransform: (items: Array<{ id: string; x: number; y: number; rotation: number; scaleX: number; scaleY: number }>) => void
  addKeyframeAtTime: (id: string) => void
  removeKeyframe: (id: string, kfId: string) => void
}

const COALESCE_MS = 900

export function selectedLayers(s: Pick<EditorState, 'doc' | 'selection'>): Layer[] {
  return s.doc.layers.filter((l) => s.selection.includes(l.id))
}

export const useEditor = create<EditorState>()((set, get) => ({
  doc: newDoc(),
  past: [],
  future: [],
  lastKey: null,
  lastTime: 0,
  selection: [],
  tool: 'select',
  panel: 'import',
  brush: { color: '#ff5d8f', size: 14 },
  maskBrush: 30,
  time: 0,
  playing: false,
  stickerId: null,
  dirty: false,

  setDoc: (recipe, meta) => {
    const s = get()
    const next = produce(s.doc, recipe)
    if (next === s.doc) return
    // Activa el modo animado automáticamente si algo se mueve
    const withAnim = !next.animated && !docHasMotion(s.doc.layers) && docHasMotion(next.layers) ? produce(next, (d) => void (d.animated = true)) : next
    const now = Date.now()
    const merge = meta?.coalesce && meta.coalesce === s.lastKey && now - s.lastTime < COALESCE_MS
    set({
      doc: withAnim,
      past: merge ? s.past : [...s.past, s.doc],
      future: [],
      lastKey: meta?.coalesce ?? null,
      lastTime: now,
      dirty: true,
    })
  },

  loadDoc: (doc, stickerId = null) => {
    set({ doc, past: [], future: [], selection: [], stickerId, dirty: false, time: 0, playing: false, lastKey: null })
    // Libera las imágenes del proyecto anterior (importante en móviles con poca memoria)
    assetCache.retainOnly(new Set(docAssetIds(doc)))
  },

  resetDoc: () => get().loadDoc(newDoc(), null),

  undo: () => {
    const s = get()
    const prev = s.past.at(-1)
    if (!prev) return
    const ids = new Set(prev.layers.map((l) => l.id))
    set({ doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], lastKey: null, selection: s.selection.filter((i) => ids.has(i)), dirty: true })
  },
  redo: () => {
    const s = get()
    const next = s.future[0]
    if (!next) return
    const ids = new Set(next.layers.map((l) => l.id))
    set({ doc: next, past: [...s.past, s.doc], future: s.future.slice(1), lastKey: null, selection: s.selection.filter((i) => ids.has(i)), dirty: true })
  },
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  select: (ids) => {
    // Seleccionar una capa de un grupo selecciona el grupo entero
    const layers = get().doc.layers
    const groups = new Set(layers.filter((l) => ids.includes(l.id) && l.groupId).map((l) => l.groupId))
    const all = layers.filter((l) => ids.includes(l.id) || (l.groupId && groups.has(l.groupId))).map((l) => l.id)
    set({ selection: all })
  },
  setTool: (tool) => set({ tool }),
  setPanel: (panel) => set({ panel }),
  setBrush: (b) => set({ brush: { ...get().brush, ...b } }),
  setMaskBrush: (maskBrush) => set({ maskBrush }),
  setTime: (time) => set({ time: Math.max(0, Math.min(get().doc.duration, time)) }),
  setPlaying: (playing) => set({ playing }),
  markSaved: (stickerId) => set({ stickerId, dirty: false }),

  addLayer: (l, select = true) => {
    haptic('tap')
    get().setDoc((d) => void d.layers.push(l as Draft<Layer>))
    if (select) set({ selection: [l.id] })
  },

  updateLayer: (id, recipe, meta) =>
    get().setDoc((d) => {
      const l = d.layers.find((x) => x.id === id)
      if (l) recipe(l as never)
    }, meta),

  updateSelected: (recipe, meta) => {
    const sel = get().selection
    get().setDoc((d) => {
      for (const l of d.layers) if (sel.includes(l.id)) recipe(l)
    }, meta)
  },

  removeLayers: (ids) => {
    if (ids.length) haptic('warning')
    if (!ids.length) return
    get().setDoc((d) => void (d.layers = d.layers.filter((l) => !ids.includes(l.id))))
    set({ selection: get().selection.filter((i) => !ids.includes(i)) })
  },

  duplicateLayers: (ids) => {
    const newIds: string[] = []
    const groupMap = new Map<string, string>()
    get().setDoc((d) => {
      const copies: Layer[] = []
      for (const l of d.layers) {
        if (!ids.includes(l.id)) continue
        const c = cloneLayer(l as Layer)
        if (c.groupId) {
          if (!groupMap.has(c.groupId)) groupMap.set(c.groupId, uid())
          c.groupId = groupMap.get(c.groupId)!
        }
        copies.push(c)
        newIds.push(c.id)
      }
      d.layers.push(...(copies as Draft<Layer>[]))
    })
    set({ selection: newIds })
  },

  moveLayer: (id, toIndex) =>
    get().setDoc((d) => {
      const i = d.layers.findIndex((l) => l.id === id)
      if (i < 0) return
      const [l] = d.layers.splice(i, 1)
      d.layers.splice(Math.max(0, Math.min(d.layers.length, toIndex)), 0, l)
    }),

  shiftLayer: (id, delta) => {
    const i = get().doc.layers.findIndex((l) => l.id === id)
    if (i >= 0) get().moveLayer(id, i + delta)
  },

  groupSelection: () => {
    const sel = get().selection
    if (sel.length < 2) return
    const gid = uid()
    get().setDoc((d) => d.layers.forEach((l) => sel.includes(l.id) && (l.groupId = gid)))
  },
  ungroupSelection: () => {
    const sel = get().selection
    get().setDoc((d) => d.layers.forEach((l) => sel.includes(l.id) && (l.groupId = null)))
  },

  alignSelection: (how) => {
    const sel = get().selection
    get().setDoc((d) => {
      for (const l of d.layers) {
        if (!sel.includes(l.id)) continue
        const h = approxHalfSize(l as Layer)
        if (how === 'left') l.x = h.w
        if (how === 'centerX') l.x = 256
        if (how === 'right') l.x = 512 - h.w
        if (how === 'top') l.y = h.h
        if (how === 'centerY') l.y = 256
        if (how === 'bottom') l.y = 512 - h.h
      }
    })
  },

  nudgeSelection: (dx, dy) => {
    const sel = get().selection
    get().setDoc(
      (d) =>
        d.layers.forEach((l) => {
          if (!sel.includes(l.id) || l.locked) return
          l.x += dx
          l.y += dy
          l.keyframes.forEach((k) => {
            k.x += dx
            k.y += dy
          })
        }),
      { coalesce: 'nudge' },
    )
  },

  commitTransform: (items) => {
    const { time } = get()
    get().setDoc((d) => {
      for (const t of items) {
        const l = d.layers.find((x) => x.id === t.id)
        if (!l) continue
        if (l.keyframes.length) {
          const scale = Math.abs(t.scaleX)
          const near = l.keyframes.find((k) => Math.abs(k.t - time) < 0.02)
          const kf: Keyframe = { id: near?.id ?? uid(), t: near?.t ?? round2(time), x: t.x, y: t.y, rotation: t.rotation, scale, opacity: near?.opacity ?? l.opacity }
          if (near) Object.assign(near, kf)
          else l.keyframes.push(kf)
          l.keyframes.sort((a, b) => a.t - b.t)
          if (Math.sign(t.scaleX) !== Math.sign(l.scaleX)) l.scaleX *= -1
        } else {
          l.x = t.x
          l.y = t.y
          l.rotation = t.rotation
          l.scaleX = t.scaleX
          l.scaleY = t.scaleY
        }
      }
    })
  },

  addKeyframeAtTime: (id) => {
    const { time, doc } = get()
    const layer = doc.layers.find((l) => l.id === id)
    if (!layer) return
    const pose = poseAt(layer, time, doc.duration, false)
    get().setDoc((d) => {
      const l = d.layers.find((x) => x.id === id)!
      if (l.keyframes.some((k) => Math.abs(k.t - time) < 0.02)) return
      l.keyframes.push({ id: uid(), t: round2(time), x: pose.x, y: pose.y, rotation: pose.rotation, scale: Math.abs(pose.scaleX), opacity: pose.opacity })
      l.keyframes.sort((a, b) => a.t - b.t)
    })
  },

  removeKeyframe: (id, kfId) =>
    get().setDoc((d) => {
      const l = d.layers.find((x) => x.id === id)
      if (l) l.keyframes = l.keyframes.filter((k) => k.id !== kfId)
    }),
}))

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function approxHalfSize(l: Layer): { w: number; h: number } {
  const sx = Math.abs(l.scaleX)
  const sy = Math.abs(l.scaleY)
  switch (l.type) {
    case 'image':
    case 'shape':
      return { w: (l.width * sx) / 2, h: (l.height * sy) / 2 }
    case 'text':
      return { w: (Math.min(l.width, l.text.length * l.fontSize * 0.6) * sx) / 2, h: (l.fontSize * sy) / 2 }
    case 'emoji':
      return { w: (l.size * sx) / 2, h: (l.size * sy) / 2 }
    case 'draw':
      return { w: 256, h: 256 }
  }
}
