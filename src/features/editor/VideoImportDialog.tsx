import { Play } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ProgressBar, Segmented } from '@/components/ui/Controls'
import { cn } from '@/components/ui/cn'
import { importVideoRange } from '@/lib/import/media'
import { haptic } from '@/lib/native/haptics'
import { toast } from '@/store/ui'
import { addMediaLayer, useImport } from './useImport'

/** WhatsApp admite animaciones de hasta 10 s */
const MAX_LEN = 10
const MIN_LEN = 0.3
const THUMBS = 10

const QUALITY = [
  { value: '10', label: 'Ligero' },
  { value: '15', label: 'Normal' },
  { value: '24', label: 'Fluido' },
] as const
type Quality = (typeof QUALITY)[number]['value']

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`

/** Miniaturas repartidas por todo el vídeo para la tira de recorte. */
async function filmstrip(url: string, duration: number, isCancelled: () => boolean): Promise<string[]> {
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  v.src = url
  await new Promise((ok, ko) => {
    v.onloadeddata = ok
    v.onerror = ko
  })
  const h = 96
  const c = document.createElement('canvas')
  c.height = h
  c.width = Math.max(1, Math.round((h * v.videoWidth) / Math.max(1, v.videoHeight)))
  const ctx = c.getContext('2d')!
  const out: string[] = []
  for (let i = 0; i < THUMBS && !isCancelled(); i++) {
    v.currentTime = Math.min(duration - 0.05, ((i + 0.5) / THUMBS) * duration)
    await new Promise((ok) => (v.onseeked = ok))
    ctx.drawImage(v, 0, 0, c.width, c.height)
    out.push(c.toDataURL('image/jpeg', 0.6))
  }
  v.removeAttribute('src')
  v.load()
  return out
}

type Drag = { kind: 'start' | 'end' | 'move'; x0: number; start0: number; end0: number }

export function VideoImportDialog() {
  const file = useImport((s) => s.video)
  const close = useImport((s) => s.closeVideo)
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(3)
  const [now, setNow] = useState(0)
  const [paused, setPaused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [quality, setQuality] = useState<Quality>('15')
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    if (!file) return
    const u = URL.createObjectURL(file)
    setUrl(u)
    setProgress(null)
    setThumbs([])
    setPaused(false)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const onMeta = () => {
    const v = videoRef.current!
    setDuration(v.duration)
    setStart(0)
    setEnd(Math.min(v.duration, 3))
    const src = v.src
    const stale = () => videoRef.current?.src !== src
    void filmstrip(src, v.duration, stale)
      .then((t) => !stale() && setThumbs(t))
      .catch(() => {})
  }

  // Reproduce en bucle solo el tramo elegido
  useEffect(() => {
    const v = videoRef.current
    if (!v || progress !== null) return
    const tick = () => {
      if (!dragRef.current && (v.currentTime >= end || v.currentTime < start - 0.05)) v.currentTime = start
      setNow(v.currentTime)
    }
    v.addEventListener('timeupdate', tick)
    if (!dragging) {
      v.currentTime = start
      if (!paused) void v.play().catch(() => {})
    }
    return () => v.removeEventListener('timeupdate', tick)
  }, [start, end, progress, dragging, paused])

  const timeAt = (clientX: number) => {
    const b = trackRef.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - b.left) / b.width)) * duration
  }

  const beginDrag = (kind: Drag['kind']) => (e: ReactPointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { kind, x0: timeAt(e.clientX), start0: start, end0: end }
    setDragging(true)
    videoRef.current?.pause()
    haptic('select')
  }

  const onDrag = (e: ReactPointerEvent) => {
    const d = dragRef.current
    const v = videoRef.current
    if (!d || !v) return
    const t = timeAt(e.clientX)
    if (d.kind === 'start') {
      const s = Math.min(Math.max(t, d.end0 - MAX_LEN, 0), d.end0 - MIN_LEN)
      setStart(s)
      v.currentTime = s
    } else if (d.kind === 'end') {
      const en = Math.max(Math.min(t, d.start0 + MAX_LEN, duration), d.start0 + MIN_LEN)
      setEnd(en)
      v.currentTime = en
    } else {
      const len = d.end0 - d.start0
      const s = Math.min(Math.max(0, d.start0 + t - d.x0), duration - len)
      setStart(s)
      setEnd(s + len)
      v.currentTime = s
    }
  }

  const endDrag = () => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
  }

  // Tocar fuera del tramo lo mueve hasta ahí, conservando su duración
  const onTrackDown = (e: ReactPointerEvent) => {
    const t = timeAt(e.clientX)
    if (t >= start && t <= end) return
    const len = end - start
    const s = Math.min(Math.max(0, t - len / 2), duration - len)
    setStart(s)
    setEnd(s + len)
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      setPaused(false)
      void v.play().catch(() => {})
    } else {
      setPaused(true)
      v.pause()
    }
  }

  const len = Math.max(0, end - start)
  const pct = (t: number) => `${duration ? (t / duration) * 100 : 0}%`

  const run = async () => {
    const v = videoRef.current!
    v.pause()
    setProgress(0)
    try {
      const media = await importVideoRange(v, start, end, Number(quality), setProgress)
      addMediaLayer(media)
      haptic('success')
      toast('Vídeo convertido en animación', 'success')
      close()
    } catch (e) {
      console.error(e)
      toast('No se pudo procesar el vídeo.', 'error')
      setProgress(null)
    }
  }

  return (
    <Modal
      open={!!file}
      onClose={close}
      title="Recortar vídeo"
      size="lg"
      dismissable={progress === null}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={progress !== null}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void run()} loading={progress !== null} disabled={len < MIN_LEN} className="min-w-32 rounded-full">
            Usar {len.toFixed(1)} s
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <button type="button" onClick={togglePlay} aria-label={paused ? 'Reproducir' : 'Pausar'} className="relative overflow-hidden rounded-2xl bg-black cursor-pointer">
          {url && <video ref={videoRef} src={url} className="mx-auto max-h-[42dvh] w-full object-contain" muted playsInline onLoadedMetadata={onMeta} />}
          {paused && progress === null && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-black/45 text-white">
                <Play className="size-6 translate-x-0.5 fill-white" />
              </span>
            </span>
          )}
        </button>

        {progress !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">Preparando la animación… {Math.round(progress * 100)}%</p>
            <ProgressBar value={progress} />
          </div>
        ) : (
          <>
            {/* Tira de recorte: arrastra los bordes para elegir el tramo, o el centro para moverlo */}
            <div
              ref={trackRef}
              onPointerDown={onTrackDown}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="relative mx-5 h-14 touch-none select-none"
              aria-label="Tramo del vídeo"
              role="group"
            >
              <div className="absolute inset-0 flex overflow-hidden rounded-xl bg-surface-3">
                {thumbs.map((t, i) => (
                  <img key={i} src={t} alt="" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
                ))}
              </div>
              {/* Zonas que se descartan */}
              <div className="absolute inset-y-0 left-0 rounded-l-xl bg-bg/75" style={{ width: pct(start) }} />
              <div className="absolute inset-y-0 right-0 rounded-r-xl bg-bg/75" style={{ left: pct(end) }} />
              {/* Tramo elegido */}
              <div
                onPointerDown={beginDrag('move')}
                className="absolute inset-y-0 cursor-grab rounded-xl border-y-[3px] border-accent active:cursor-grabbing"
                style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }}
              >
                {!dragging && now >= start && now <= end && (
                  <span className="pointer-events-none absolute inset-y-0 w-0.5 rounded bg-white shadow" style={{ left: `${((now - start) / Math.max(0.01, len)) * 100}%` }} />
                )}
              </div>
              {(['start', 'end'] as const).map((k) => (
                <div
                  key={k}
                  role="slider"
                  aria-label={k === 'start' ? 'Inicio del tramo' : 'Fin del tramo'}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration * 10) / 10}
                  aria-valuenow={Math.round((k === 'start' ? start : end) * 10) / 10}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    const d = e.key === 'ArrowLeft' ? -0.1 : e.key === 'ArrowRight' ? 0.1 : 0
                    if (!d) return
                    e.preventDefault()
                    if (k === 'start') setStart(Math.min(Math.max(0, start + d, end - MAX_LEN), end - MIN_LEN))
                    else setEnd(Math.max(Math.min(duration, end + d, start + MAX_LEN), start + MIN_LEN))
                  }}
                  onPointerDown={beginDrag(k)}
                  className={cn(
                    'absolute inset-y-0 z-10 grid w-5 cursor-ew-resize place-items-center bg-accent',
                    k === 'start' ? '-translate-x-full rounded-l-xl' : 'rounded-r-xl',
                  )}
                  style={{ left: pct(k === 'start' ? start : end) }}
                >
                  <span className="h-5 w-1 rounded-full bg-white/90" />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 px-1 text-sm">
              <span className="font-mono tabular-nums text-muted">
                {fmt(start)} – {fmt(end)}
              </span>
              <span className={cn('font-bold tabular-nums', len >= MAX_LEN - 0.05 && 'text-accent-text')}>{len.toFixed(1)} s {len >= MAX_LEN - 0.05 && '(máx.)'}</span>
            </div>

            <Segmented label="Calidad de la animación" options={QUALITY.map((q) => ({ ...q, title: `${q.value} fotogramas por segundo` }))} value={quality} onChange={setQuality} />
          </>
        )}
      </div>
    </Modal>
  )
}
