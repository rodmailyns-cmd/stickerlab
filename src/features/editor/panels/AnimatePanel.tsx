import { motion } from 'framer-motion'
import { Diamond, Trash2 } from 'lucide-react'
import type { AnimationPresetId } from '@/types/doc'
import { Button } from '@/components/ui/Button'
import { Section, Slider, Toggle } from '@/components/ui/Controls'
import { cn } from '@/components/ui/cn'
import { PRESETS } from '@/lib/animation/presets'
import { useEditor } from '@/store/editor'
import { useSelectedLayer } from './common'

export function AnimatePanel() {
  const doc = useEditor((s) => s.doc)
  const setDoc = useEditor((s) => s.setDoc)
  const time = useEditor((s) => s.time)
  const sel = useSelectedLayer()
  const updateLayer = useEditor((s) => s.updateLayer)
  const addKeyframe = useEditor((s) => s.addKeyframeAtTime)
  const removeKeyframe = useEditor((s) => s.removeKeyframe)

  const togglePreset = (id: AnimationPresetId) => {
    if (!sel) return
    updateLayer(sel.id, (l) => {
      const i = l.animations.findIndex((a) => a.preset === id)
      if (i >= 0) l.animations.splice(i, 1)
      else l.animations.push({ preset: id, speed: 1, intensity: 1 })
    })
    if (!doc.animated) setDoc((d) => void (d.animated = true))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-3xl bg-gradient-to-br from-accent-soft to-surface-3 p-4">
        <Toggle label="Sticker animado" hint={doc.animated ? 'Se exportará como WebP animado (máx. 500 KB)' : 'Ahora se exporta como estático (máx. 100 KB)'} checked={doc.animated} onChange={(v) => setDoc((d) => void (d.animated = v))} />
      </div>

      {doc.animated && (
        <Section title="Reproducción">
          <Slider label="Fotogramas por segundo" value={doc.fps} min={8} max={30} onChange={(v) => setDoc((d) => void (d.fps = v), { coalesce: 'fps' })} format={(v) => `${v} FPS`} />
          <Slider label="Duración" value={doc.duration} min={0.5} max={10} step={0.1} onChange={(v) => setDoc((d) => void (d.duration = v), { coalesce: 'dur' })} format={(v) => `${v.toFixed(1)} s`} />
          <Toggle label="Repetir en bucle" hint="WhatsApp reproduce los stickers en bucle" checked={doc.loop} onChange={(v) => setDoc((d) => void (d.loop = v))} />
        </Section>
      )}

      <Section title={sel ? `Animaciones de "${sel.name}"` : 'Animaciones prediseñadas'}>
        {!sel && <p className="-mt-1 text-xs text-muted">Selecciona una capa y elige uno o varios efectos.</p>}
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const active = !!sel?.animations.some((a) => a.preset === p.id)
            return (
              <motion.button
                key={p.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.94 }}
                disabled={!sel}
                onClick={() => togglePreset(p.id)}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl border-2 px-1 py-2.5 text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                  active ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface hover:border-accent/40',
                )}
              >
                <motion.span className="text-2xl" animate={active ? { scale: [1, 1.25, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }}>
                  {p.emoji}
                </motion.span>
                {p.label}
              </motion.button>
            )
          })}
        </div>
        {sel?.animations.map((a, i) => (
          <div key={a.preset} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
            <p className="text-sm font-extrabold">{PRESETS.find((p) => p.id === a.preset)?.label}</p>
            <Slider label="Velocidad" value={a.speed} min={0.25} max={4} step={0.25} format={(v) => `×${v}`} onChange={(v) => updateLayer(sel.id, (l) => void (l.animations[i].speed = v), { coalesce: `${sel.id}-sp${i}` })} />
            {a.preset !== 'spin' && a.preset !== 'rainbow' && (
              <Slider label="Intensidad" value={a.intensity} min={0.1} max={2} step={0.1} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => updateLayer(sel.id, (l) => void (l.animations[i].intensity = v), { coalesce: `${sel.id}-in${i}` })} />
            )}
          </div>
        ))}
      </Section>

      {sel && doc.animated && (
        <>
          <Section title="Keyframes">
            <p className="-mt-1 text-xs text-muted">Mueve la línea de tiempo, coloca la capa y añade un keyframe. Entre keyframes el movimiento se interpola suavemente.</p>
            <Button size="sm" icon={Diamond} onClick={() => addKeyframe(sel.id)}>
              Añadir keyframe en {time.toFixed(2)} s
            </Button>
            {sel.keyframes.length > 0 && (
              <ul className="flex flex-col gap-1">
                {sel.keyframes.map((k) => (
                  <li key={k.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-1.5 text-sm">
                    <button className="flex items-center gap-2 font-bold cursor-pointer" onClick={() => useEditor.getState().setTime(k.t)}>
                      <Diamond className="size-3.5 fill-accent text-accent" /> {k.t.toFixed(2)} s
                    </button>
                    <button aria-label="Borrar keyframe" className="rounded-lg p-1 hover:bg-surface-3 cursor-pointer" onClick={() => removeKeyframe(sel.id, k.id)}>
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Cuándo aparece">
            <Toggle
              label="Solo en un intervalo"
              hint="Útil para animación fotograma a fotograma"
              checked={!!sel.span}
              onChange={(v) => updateLayer(sel.id, (l) => void (l.span = v ? { start: 0, end: Math.min(doc.duration, 1) } : null))}
            />
            {sel.span && (
              <>
                <Slider label="Desde" value={sel.span.start} min={0} max={doc.duration} step={1 / doc.fps} format={(v) => `${v.toFixed(2)} s`} onChange={(v) => updateLayer(sel.id, (l) => void (l.span = { start: Math.min(v, l.span!.end - 1 / doc.fps), end: l.span!.end }), { coalesce: `${sel.id}-ss` })} />
                <Slider label="Hasta" value={sel.span.end} min={0} max={doc.duration} step={1 / doc.fps} format={(v) => `${v.toFixed(2)} s`} onChange={(v) => updateLayer(sel.id, (l) => void (l.span = { start: l.span!.start, end: Math.max(v, l.span!.start + 1 / doc.fps) }), { coalesce: `${sel.id}-se` })} />
              </>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
