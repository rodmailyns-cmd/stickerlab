import { motion } from 'framer-motion'
import { Diamond, Pause, Play, Repeat, SkipBack } from 'lucide-react'
import { useRef } from 'react'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { PRESETS } from '@/lib/animation/presets'
import { useEditor } from '@/store/editor'

export function Timeline({ compact = false }: { compact?: boolean }) {
  const doc = useEditor((s) => s.doc)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const selection = useEditor((s) => s.selection)
  const { setTime, setPlaying, select, setDoc } = useEditor.getState()
  const trackRef = useRef<HTMLDivElement>(null)

  const dur = doc.duration
  const frames = Math.round(dur * doc.fps)
  const pct = (t: number) => `${(t / dur) * 100}%`

  const scrub = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect()
    const t = ((clientX - r.left) / r.width) * dur
    setTime(Math.round(Math.max(0, Math.min(dur, t)) * doc.fps) / doc.fps)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    setPlaying(false)
    scrub(e.clientX)
    const move = (ev: PointerEvent) => scrub(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const frameIndex = Math.min(frames - 1, Math.floor(time * doc.fps))
  const layers = [...doc.layers].reverse()

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-3xl border-2 border-line bg-surface/90 p-1.5 shadow-soft" aria-label="Línea de tiempo">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-white cursor-pointer"
        >
          {playing ? <Pause className="size-3.5 fill-white" /> : <Play className="size-3.5 translate-x-px fill-white" />}
        </motion.button>
        <div ref={trackRef} onPointerDown={onPointerDown} className="relative h-6 flex-1 touch-none overflow-hidden rounded-xl bg-surface-3">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent/40 to-accent-2/40" style={{ width: pct(time) }} />
          <div className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: pct(time) }} />
        </div>
        <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-muted">
          {time.toFixed(1)}/{dur.toFixed(1)}s · {doc.fps}fps
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-3xl border-2 border-line bg-surface/90 p-2.5 shadow-soft backdrop-blur" aria-label="Línea de tiempo">
      <div className="flex items-center gap-1.5">
        <IconButton icon={SkipBack} label="Ir al inicio" size="sm" onClick={() => setTime(0)} />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? 'Pausar (espacio)' : 'Reproducir (espacio)'}
          title={playing ? 'Pausar (espacio)' : 'Reproducir (espacio)'}
          className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-white shadow-soft cursor-pointer"
        >
          {playing ? <Pause className="size-4 fill-white" /> : <Play className="size-4 translate-x-px fill-white" />}
        </motion.button>
        <span className="ml-1 font-mono text-xs font-bold tabular-nums text-muted">
          {time.toFixed(2)} / {dur.toFixed(1)} s · fotograma {frameIndex + 1}/{frames}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <IconButton icon={Repeat} label={doc.loop ? 'Bucle activado' : 'Bucle desactivado'} active={doc.loop} size="sm" onClick={() => setDoc((d) => void (d.loop = !d.loop))} />
          <span className="rounded-lg bg-surface-3 px-2 py-1 text-xs font-extrabold">{doc.fps} FPS</span>
        </span>
      </div>

      <div className="relative select-none touch-none" onPointerDown={onPointerDown}>
        <div className="flex gap-2">
        {!compact && <span className="w-24 shrink-0 text-[11px] font-bold text-muted self-center px-2">Fotogramas</span>}
        <div ref={trackRef} className="relative h-6 flex-1 rounded-xl bg-surface-3">
          {/* Marcas de fotogramas */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: Math.min(frames, 120) }, (_, i) => (
              <span key={i} className={cn('h-full flex-1 border-r border-line/70', i === frameIndex && 'bg-accent/25')} />
            ))}
          </div>
        </div>
        </div>
        {!compact && (
          <div className="scroll-thin mt-1.5 flex max-h-32 flex-col gap-1 overflow-y-auto">
            {layers.map((l) => {
              const sel = selection.includes(l.id)
              const span = l.span ?? { start: 0, end: dur }
              return (
                <div key={l.id} className="flex items-center gap-2">
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => select([l.id])}
                    className={cn('w-24 shrink-0 truncate rounded-lg px-2 py-0.5 text-left text-[11px] font-bold cursor-pointer', sel ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-3')}
                  >
                    {l.name}
                  </button>
                  <div className="relative h-5 flex-1 rounded-lg bg-surface-2">
                    <div
                      className={cn('absolute inset-y-0.5 rounded-md', sel ? 'bg-gradient-to-r from-accent/70 to-accent-2/70' : 'bg-accent-2/30')}
                      style={{ left: pct(span.start), width: pct(Math.max(0, Math.min(dur, span.end) - span.start)) }}
                    />
                    <div className="absolute inset-y-0 left-1 flex items-center gap-0.5 text-[11px]">
                      {l.animations.map((a) => (
                        <span key={a.preset} title={a.preset}>
                          {PRESETS.find((p) => p.id === a.preset)?.emoji}
                        </span>
                      ))}
                    </div>
                    {l.keyframes.map((k) => (
                      <Diamond key={k.id} className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 fill-lemon text-ink" style={{ left: pct(k.t) }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {/* Cabezal */}
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `calc(${compact ? '0px' : '6.5rem'} + (100% - ${compact ? '0px' : '6.5rem'}) * ${time / dur})` }}>
          <div className="absolute -top-1 bottom-0 w-0.5 -translate-x-1/2 rounded bg-accent" />
          <div className="absolute -top-1.5 size-3 -translate-x-1/2 rounded-full border-2 border-white bg-accent shadow" />
        </div>
      </div>
    </div>
  )
}
