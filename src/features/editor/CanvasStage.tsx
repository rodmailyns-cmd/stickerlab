import Konva from 'konva'
import { Minimize } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CANVAS_SIZE, type Layer } from '@/types/doc'
import { SceneRenderer } from '@/lib/render/renderer'
import { newDrawLayer } from '@/lib/doc/factory'
import { useEditor } from '@/store/editor'
import { cn } from '@/components/ui/cn'
import { haptic } from '@/lib/native/haptics'

function EmptyCanvas() {
  const setPanel = useEditor((s) => s.setPanel)
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-display text-lg font-semibold text-muted">Empieza tu sticker</p>
      <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
        <button onClick={() => setPanel('import')} className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white cursor-pointer">
          Importar imagen
        </button>
        <button onClick={() => setPanel('templates')} className="rounded-full bg-surface px-4 py-2 text-sm font-bold cursor-pointer">
          Plantillas
        </button>
      </div>
    </div>
  )
}

const ACCENT = '#ff4fa0'

/** Transformación de una capa (sin animaciones) para convertir coordenadas. */
function layerTransform(l: Layer): Konva.Transform {
  const t = new Konva.Transform()
  t.translate(l.x, l.y)
  t.rotate((l.rotation * Math.PI) / 180)
  t.scale(l.scaleX, l.scaleY)
  return t
}

export function CanvasStage({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const rRef = useRef<SceneRenderer | null>(null)
  const trRef = useRef<Konva.Transformer | null>(null)
  const previewRef = useRef<Konva.Line | null>(null)
  const cursorRef = useRef<Konva.Circle | null>(null)
  const [size, setSize] = useState(400)
  /** Zoom de la vista (pellizcar con dos dedos sin capa seleccionada). No cambia el sticker. */
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  const cancelStrokeRef = useRef<() => void>(() => {})

  const doc = useEditor((s) => s.doc)
  const selection = useEditor((s) => s.selection)
  const tool = useEditor((s) => s.tool)
  const playing = useEditor((s) => s.playing)
  const time = useEditor((s) => s.time)

  // Crear el escenario una vez
  useEffect(() => {
    const host = hostRef.current!
    const r = new SceneRenderer(host, 400, true)
    const tr = new Konva.Transformer({
      anchorFill: '#ffffff',
      anchorStroke: ACCENT,
      anchorStrokeWidth: 2.5,
      anchorSize: 14,
      anchorCornerRadius: 8,
      borderStroke: ACCENT,
      borderStrokeWidth: 2,
      borderDash: [6, 4],
      rotateAnchorOffset: 34,
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
      rotationSnapTolerance: 4,
      padding: 4,
      ignoreStroke: true,
      flipEnabled: true,
    })
    const preview = new Konva.Line({ listening: false, lineCap: 'round', lineJoin: 'round', tension: 0.4, visible: false })
    const cursor = new Konva.Circle({ listening: false, stroke: ACCENT, strokeWidth: 1.5, dash: [4, 3], visible: false })
    r.ui!.add(tr, preview, cursor)
    rRef.current = r
    trRef.current = tr
    previewRef.current = preview
    cursorRef.current = cursor
    return () => {
      r.destroy()
      rRef.current = null
    }
  }, [])

  // Tamaño responsive
  useEffect(() => {
    const wrap = wrapRef.current!
    const ro = new ResizeObserver(() => {
      const b = wrap.getBoundingClientRect()
      setSize(Math.max(160, Math.floor(Math.min(b.width, b.height))))
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    rRef.current?.setDisplaySize(size)
  }, [size])

  // Render en modo edición (cuando no se reproduce)
  useEffect(() => {
    const r = rRef.current
    if (!r || playing) return
    r.render(doc, { t: doc.animated ? time : null, frameTime: time, mode: 'edit' })
  }, [doc, time, playing, size])

  // Bucle de reproducción
  useEffect(() => {
    const r = rRef.current
    if (!r || !playing) return
    let raf = 0
    const startTime = useEditor.getState().time
    const t0 = performance.now()
    const tick = (now: number) => {
      const d = useEditor.getState().doc
      const dur = Math.max(0.1, d.duration)
      let t = startTime + (now - t0) / 1000
      if (t >= dur) {
        if (!d.loop) {
          useEditor.getState().setPlaying(false)
          useEditor.getState().setTime(dur)
          return
        }
        t %= dur
      }
      // Cuantiza al FPS del sticker para ver exactamente lo que se exportará
      const tq = Math.floor(t * d.fps) / d.fps
      r.render(d, { t: tq, frameTime: tq, mode: 'play' })
      useEditor.setState({ time: t })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // Transformer y arrastre
  useEffect(() => {
    const r = rRef.current
    const tr = trRef.current
    if (!r || !tr) return
    const editable = tool === 'select' && !playing
    const nodes: Konva.Group[] = []
    for (const l of doc.layers) {
      const g = r.groupFor(l.id)
      if (!g) continue
      const sel = selection.includes(l.id)
      g.draggable(editable && sel && !l.locked)
      if (sel && !l.locked && l.visible && editable) nodes.push(g)
    }
    tr.nodes(nodes)
    const only = nodes.length === 1 ? doc.layers.find((l) => l.id === nodes[0].id()) : null
    tr.keepRatio(only?.type !== 'shape' && only?.type !== 'image')
    tr.enabledAnchors(
      only?.type === 'shape' || only?.type === 'image'
        ? ['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right']
        : ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    )
    tr.getLayer()?.batchDraw()
  }, [doc, selection, tool, playing, size])

  // Eventos del escenario
  useEffect(() => {
    const r = rRef.current!
    const stage = r.stage
    const tr = trRef.current!
    const preview = previewRef.current!
    const cursor = cursorRef.current!
    let stroke: { points: number[]; layerId: string | null; kind: 'draw' | 'mask' | 'lasso'; mode: 'brush' | 'eraser' | 'erase' | 'restore' } | null = null

    const docPoint = () => {
      const p = stage.getPointerPosition()
      if (!p) return null
      const s = stage.scaleX()
      return { x: p.x / s, y: p.y / s }
    }

    const commitPositions = () => {
      const st = useEditor.getState()
      const items = tr.nodes().map((n) => ({ id: n.id(), x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() }))
      if (items.length) st.commitTransform(items)
    }

    const onDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      const st = useEditor.getState()
      if (st.playing) st.setPlaying(false)
      const p = docPoint()
      if (!p) return
      if (st.tool === 'select') {
        if (e.target.getParent() instanceof Konva.Transformer) return
        const group = e.target.findAncestor('.sl-layer', true) as Konva.Group | undefined
        if (!group) {
          st.select([])
          return
        }
        const id = group.id()
        const additive = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey
        if (additive) st.select(st.selection.includes(id) ? st.selection.filter((x) => x !== id) : [...st.selection, id])
        else if (!st.selection.includes(id)) st.select([id])
        return
      }
      const sel = st.doc.layers.find((l) => st.selection.includes(l.id))
      if (st.tool === 'brush' || st.tool === 'eraser') {
        let target = sel?.type === 'draw' ? sel : null
        if (!target) {
          if (st.tool === 'eraser') return
          target = newDrawLayer()
          st.addLayer(target)
        }
        const local = layerTransform(target).invert().point(p)
        stroke = { points: [local.x + CANVAS_SIZE / 2, local.y + CANVAS_SIZE / 2], layerId: target.id, kind: 'draw', mode: st.tool }
        preview.setAttrs({
          points: [p.x, p.y, p.x + 0.1, p.y],
          stroke: st.tool === 'eraser' ? 'rgba(255,255,255,0.85)' : st.brush.color,
          strokeWidth: st.brush.size * Math.abs(target.scaleX),
          dash: st.tool === 'eraser' ? [2, 6] : [],
          visible: true,
          opacity: 1,
        })
      } else if (sel?.type === 'image') {
        const local = layerTransform(sel).invert().point(p)
        const lp = [local.x + sel.width / 2, local.y + sel.height / 2]
        if (st.tool === 'lasso') {
          stroke = { points: lp, layerId: sel.id, kind: 'lasso', mode: 'brush' }
          preview.setAttrs({ points: [p.x, p.y], stroke: ACCENT, strokeWidth: 3, dash: [8, 6], visible: true, opacity: 1, tension: 0 })
        } else {
          stroke = { points: lp, layerId: sel.id, kind: 'mask', mode: st.tool === 'mask-erase' ? 'erase' : 'restore' }
          preview.setAttrs({
            points: [p.x, p.y, p.x + 0.1, p.y],
            stroke: st.tool === 'mask-erase' ? 'rgba(255,79,160,0.45)' : 'rgba(76,201,166,0.5)',
            strokeWidth: st.maskBrush * Math.abs(sel.scaleX),
            dash: [],
            visible: true,
            opacity: 1,
            tension: 0.4,
          })
        }
      }
      preview.getLayer()?.batchDraw()
    }

    const onMove = () => {
      const st = useEditor.getState()
      const p = docPoint()
      if (!p) return
      const brushTool = st.tool === 'brush' || st.tool === 'eraser' || st.tool === 'mask-erase' || st.tool === 'mask-restore'
      if (brushTool) {
        const radius = (st.tool === 'brush' || st.tool === 'eraser' ? st.brush.size : st.maskBrush) / 2
        cursor.setAttrs({ x: p.x, y: p.y, radius, visible: true })
      } else cursor.visible(false)
      if (stroke) {
        const layer = st.doc.layers.find((l) => l.id === stroke!.layerId)
        if (layer) {
          const local = layerTransform(layer).invert().point(p)
          if (stroke.kind === 'draw') stroke.points.push(local.x + CANVAS_SIZE / 2, local.y + CANVAS_SIZE / 2)
          else if (layer.type === 'image') stroke.points.push(local.x + layer.width / 2, local.y + layer.height / 2)
        }
        preview.points([...preview.points(), p.x, p.y])
      }
      cursor.getLayer()?.batchDraw()
    }

    const onUp = () => {
      const st = useEditor.getState()
      if (!stroke) return
      const s = stroke
      stroke = null
      preview.visible(false)
      preview.getLayer()?.batchDraw()
      if (!s.layerId) return
      if (s.kind === 'draw') {
        st.updateLayer(s.layerId, (l) => {
          if (l.type === 'draw') l.lines.push({ mode: s.mode === 'eraser' ? 'eraser' : 'brush', color: st.brush.color, size: st.brush.size, points: s.points })
        })
      } else if (s.kind === 'mask') {
        st.updateLayer(s.layerId, (l) => {
          if (l.type === 'image') l.mask.push({ mode: s.mode === 'restore' ? 'restore' : 'erase', size: st.maskBrush, points: s.points })
        })
      } else if (s.kind === 'lasso' && s.points.length >= 6) {
        st.updateLayer(s.layerId, (l) => {
          if (l.type === 'image') l.crop = { ...l.crop, shape: 'lasso', points: s.points }
        })
        st.setTool('select')
      }
    }

    cancelStrokeRef.current = () => {
      stroke = null
      preview.visible(false)
      preview.getLayer()?.batchDraw()
    }

    const onLeave = () => {
      cursor.visible(false)
      cursor.getLayer()?.batchDraw()
    }

    const onDbl = (e: Konva.KonvaEventObject<MouseEvent>) => {
      const group = e.target.findAncestor('.sl-layer', true) as Konva.Group | undefined
      const l = group && useEditor.getState().doc.layers.find((x) => x.id === group.id())
      if (l?.type === 'text') useEditor.getState().setPanel('text')
    }

    stage.on('pointerdown', onDown)
    stage.on('pointermove', onMove)
    stage.on('pointerleave', onLeave)
    stage.on('dblclick dbltap', onDbl)
    window.addEventListener('pointerup', onUp)
    stage.on('dragmove', () => r.refreshSceneCache())
    stage.on('dragend', commitPositions)
    tr.on('transform', () => r.refreshSceneCache())
    tr.on('transformend', commitPositions)
    return () => {
      stage.off('pointerdown pointermove pointerleave dblclick dbltap dragmove dragend')
      tr.off('transform transformend')
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  // Gestos táctiles con dos dedos: pellizcar para escalar y girar la capa seleccionada,
  // o para hacer zoom en la vista si no hay ninguna seleccionada.
  useEffect(() => {
    const host = hostRef.current!
    type Gesture =
      | { kind: 'layer'; id: string; d0: number; a0: number; m0: { x: number; y: number }; start: { x: number; y: number; rotation: number; scaleX: number; scaleY: number } }
      | { kind: 'view'; d0: number; m0: { x: number; y: number }; start: { zoom: number; x: number; y: number } }
    let g: Gesture | null = null
    const metrics = (t: TouchList) => {
      const [a, b] = [t[0], t[1]]
      return {
        d: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        a: (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180) / Math.PI,
        m: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 },
      }
    }
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      const r = rRef.current
      const st = useEditor.getState()
      if (!r) return
      cancelStrokeRef.current()
      r.stage.find('.sl-layer').forEach((n) => n.isDragging() && n.stopDrag())
      const { d, a, m } = metrics(e.touches)
      const layer = st.tool === 'select' && st.selection.length === 1 ? st.doc.layers.find((l) => l.id === st.selection[0] && !l.locked) : undefined
      const node = layer && r.groupFor(layer.id)
      if (node) {
        g = { kind: 'layer', id: layer.id, d0: d, a0: a, m0: m, start: { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() } }
        trRef.current?.visible(false)
      } else {
        g = { kind: 'view', d0: d, m0: m, start: { ...viewRef.current } }
      }
    }
    const onMove = (e: TouchEvent) => {
      if (!g || e.touches.length < 2) return
      e.preventDefault()
      const { d, a, m } = metrics(e.touches)
      const k = d / Math.max(1, g.d0)
      if (g.kind === 'view') {
        const zoom = Math.min(4, Math.max(1, g.start.zoom * k))
        setView(zoom === 1 ? { zoom: 1, x: 0, y: 0 } : { zoom, x: g.start.x + (m.x - g.m0.x), y: g.start.y + (m.y - g.m0.y) })
        return
      }
      const r = rRef.current
      const node = r?.groupFor(g.id)
      if (!r || !node) return
      const px = r.stage.scaleX() * viewRef.current.zoom
      let rot = g.start.rotation + (a - g.a0)
      const snap = Math.round(rot / 45) * 45
      if (Math.abs(rot - snap) < 4) rot = snap
      const sx = Math.sign(g.start.scaleX) * Math.min(20, Math.max(0.05, Math.abs(g.start.scaleX) * k))
      const sy = Math.sign(g.start.scaleY) * Math.min(20, Math.max(0.05, Math.abs(g.start.scaleY) * k))
      node.setAttrs({ x: g.start.x + (m.x - g.m0.x) / px, y: g.start.y + (m.y - g.m0.y) / px, rotation: rot, scaleX: sx, scaleY: sy })
      r.refreshSceneCache()
    }
    const onEnd = (e: TouchEvent) => {
      if (!g || e.touches.length >= 2) return
      const done = g
      g = null
      if (done.kind === 'layer') {
        const node = rRef.current?.groupFor(done.id)
        trRef.current?.visible(true)
        if (node) useEditor.getState().commitTransform([{ id: done.id, x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() }])
      }
      haptic('select')
    }
    host.addEventListener('touchstart', onStart, { passive: false })
    host.addEventListener('touchmove', onMove, { passive: false })
    host.addEventListener('touchend', onEnd)
    host.addEventListener('touchcancel', onEnd)
    return () => {
      host.removeEventListener('touchstart', onStart)
      host.removeEventListener('touchmove', onMove)
      host.removeEventListener('touchend', onEnd)
      host.removeEventListener('touchcancel', onEnd)
    }
  }, [])
  const cursorClass =
    tool === 'select' ? 'cursor-default' : tool === 'lasso' ? 'cursor-crosshair' : 'cursor-none'

  return (
    <div ref={wrapRef} className={cn('relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden', className)}>
      <div
        className="checker relative overflow-hidden rounded-2xl"
        style={{ width: size, height: size, transform: view.zoom !== 1 ? `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` : undefined }}
      >
        <div ref={hostRef} className={cn('absolute inset-0 touch-none', cursorClass)} aria-label="Lienzo del sticker, 512 por 512 píxeles" role="img" />
        {doc.layers.length === 0 && <EmptyCanvas />}
      </div>
      {view.zoom !== 1 && (
        <button
          onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold cursor-pointer"
        >
          <Minimize className="size-3.5" /> {Math.round(view.zoom * 100)} % · Ajustar
        </button>
      )}
    </div>
  )
}
