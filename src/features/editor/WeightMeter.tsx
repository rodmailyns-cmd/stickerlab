import { Gauge } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/components/ui/cn'
import { estimateSticker } from '@/lib/render/exporter'
import { formatBytes } from '@/lib/export/limits'
import { useEditor } from '@/store/editor'

/** Calculadora de peso en vivo: estima el tamaño final mientras editas. */
export function WeightMeter() {
  const doc = useEditor((s) => s.doc)
  const playing = useEditor((s) => s.playing)
  const [est, setEst] = useState<{ bytes: number; maxBytes: number; animated: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    if (playing || !doc.layers.length) {
      if (!doc.layers.length) setEst(null)
      return
    }
    const id = ++seq.current
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const r = await estimateSticker(doc)
        if (id === seq.current) setEst(r)
      } catch (e) {
        console.warn(e)
      } finally {
        if (id === seq.current) setBusy(false)
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [doc, playing])

  if (!est) {
    return (
      <span className="hidden items-center gap-1.5 rounded-2xl bg-surface-2 px-3 py-1.5 text-xs font-bold text-muted md:flex">
        <Gauge className="size-4" /> {busy ? 'Calculando…' : 'Peso: —'}
      </span>
    )
  }
  const ratio = est.bytes / est.maxBytes
  const over = ratio > 1
  return (
    <div
      className="flex min-w-0 items-center gap-1.5 rounded-2xl bg-surface-2 px-2 py-1.5 sm:gap-2 sm:px-3"
      title={over ? 'Al guardar se optimizará automáticamente (calidad, FPS o colores) hasta cumplir el límite de WhatsApp.' : 'Cumple el límite de WhatsApp'}
      aria-live="polite"
    >
      <Gauge className={cn('size-4 shrink-0', over ? 'text-lemon' : 'text-ok', busy && 'animate-pulse')} />
      <div className="hidden w-20 sm:block">
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div className={cn('h-full rounded-full transition-all', over ? 'bg-lemon' : ratio > 0.8 ? 'bg-sky' : 'bg-ok')} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
      </div>
      <span className="whitespace-nowrap text-xs font-bold tabular-nums">
        ≈{formatBytes(est.bytes)} <span className="hidden font-semibold text-muted sm:inline">/ {formatBytes(est.maxBytes)}</span>
      </span>
      {over && <span className="hidden whitespace-nowrap rounded-lg bg-lemon/25 px-1.5 text-[11px] font-bold lg:inline">se optimizará</span>}
    </div>
  )
}
