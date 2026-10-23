import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { TextLayer } from '@/types/doc'
import { NO_SHADOW } from '@/types/doc'
import { Button } from '@/components/ui/Button'
import { Chip, ColorField, Section, Segmented, Slider, TextInput, Toggle } from '@/components/ui/Controls'
import { cn } from '@/components/ui/cn'
import { FONTS, ensureFont } from '@/lib/render/fonts'
import { newTextLayer } from '@/lib/doc/factory'
import { useEditor } from '@/store/editor'
import { ShadowControls, useSelectedLayer } from './common'

export const TEXT_PRESETS: { id: string; label: string; patch: Partial<TextLayer> }[] = [
  { id: 'meme', label: 'Meme clásico', patch: { fontFamily: 'Anton', fill: '#ffffff', stroke: '#000000', strokeWidth: 10, bold: false, gradient: null, shadow: { ...NO_SHADOW } } },
  { id: 'kawaii', label: 'Kawaii', patch: { fontFamily: 'Fredoka', fill: '#ff5d8f', stroke: '#ffffff', strokeWidth: 12, bold: true, gradient: null, shadow: { ...NO_SHADOW, enabled: true, color: '#c77dff', blur: 0, offsetX: 0, offsetY: 6, opacity: 0.6 } } },
  { id: 'comic', label: 'Cómic', patch: { fontFamily: 'Bangers', fill: '#ffd43b', stroke: '#1a1a1a', strokeWidth: 10, bold: false, gradient: null, letterSpacing: 2, shadow: { ...NO_SHADOW, enabled: true, color: '#1a1a1a', blur: 0, offsetX: 5, offsetY: 5, opacity: 1 } } },
  { id: 'neon', label: 'Neón', patch: { fontFamily: 'Righteous', fill: '#ffffff', stroke: '#ff4fa0', strokeWidth: 4, bold: false, gradient: null, shadow: { ...NO_SHADOW, enabled: true, color: '#ff4fa0', blur: 24, offsetX: 0, offsetY: 0, opacity: 1 } } },
  { id: 'rainbow', label: 'Arcoíris', patch: { fontFamily: 'Titan One', gradient: { from: '#ff5d8f', to: '#4dabf7', angle: 0 }, stroke: '#ffffff', strokeWidth: 12, bold: false, shadow: { ...NO_SHADOW } } },
  { id: 'retro', label: 'Retro', patch: { fontFamily: 'Press Start 2P', fill: '#51cf66', stroke: '#1b1b2f', strokeWidth: 8, bold: false, gradient: null, fontSize: 44, shadow: { ...NO_SHADOW } } },
  { id: 'marker', label: 'Rotulador', patch: { fontFamily: 'Permanent Marker', fill: '#2b2d42', stroke: '#ffffff', strokeWidth: 10, bold: false, gradient: null, shadow: { ...NO_SHADOW } } },
  { id: 'cute', label: 'Cursiva', patch: { fontFamily: 'Pacifico', fill: '#ffffff', stroke: '#9775fa', strokeWidth: 9, bold: false, gradient: null, shadow: { ...NO_SHADOW, enabled: true, color: '#000000', blur: 10, offsetX: 0, offsetY: 4, opacity: 0.25 } } },
]

export function TextPanel() {
  const sel = useSelectedLayer()
  const layer = sel?.type === 'text' ? sel : null
  const addLayer = useEditor((s) => s.addLayer)
  const updateLayer = useEditor((s) => s.updateLayer)
  const [fontCat, setFontCat] = useState<string>('todas')

  // Carga las fuentes para que la lista se vea con su tipografía
  useEffect(() => {
    FONTS.forEach((f) => void ensureFont(f.family))
  }, [])

  const set = (recipe: (l: TextLayer) => void, key?: string) => layer && updateLayer<TextLayer>(layer.id, recipe as never, key ? { coalesce: `${layer.id}-${key}` } : undefined)

  const fonts = useMemo(() => (fontCat === 'todas' ? FONTS : FONTS.filter((f) => f.category === fontCat)), [fontCat])

  return (
    <div className="flex flex-col gap-5">
      <Button variant="primary" icon={Plus} onClick={() => addLayer(newTextLayer('¡Hola!'))}>
        Añadir texto
      </Button>

      <Section title="Estilos rápidos">
        <div className="grid grid-cols-2 gap-2">
          {TEXT_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => (layer ? set((l) => void Object.assign(l, structuredClone(p.patch))) : addLayer(newTextLayer(p.id === 'meme' ? 'CUANDO...' : '¡Hola!', structuredClone(p.patch))))}
              className="truncate rounded-2xl border-2 border-line bg-surface-2 px-2 py-2.5 text-[17px] transition hover:-translate-y-0.5 hover:border-accent/50 cursor-pointer"
              style={{
                fontFamily: `"${p.patch.fontFamily}"`,
                color: p.patch.gradient ? p.patch.gradient.from : p.patch.fill,
                WebkitTextStroke: `${Math.min(3, (p.patch.strokeWidth ?? 0) / 4)}px ${p.patch.stroke}`,
                paintOrder: 'stroke fill',
                textShadow: p.patch.shadow?.enabled ? `${p.patch.shadow.offsetX / 2}px ${p.patch.shadow.offsetY / 2}px ${p.patch.shadow.blur / 2}px ${p.patch.shadow.color}` : undefined,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Section>

      {!layer ? (
        <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">Selecciona un texto del lienzo para editarlo, o añade uno nuevo.</p>
      ) : (
        <>
          <TextInput label="Texto" multiline value={layer.text} onChange={(v) => set((l) => void (l.text = v), 'text')} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="soft" onClick={() => set((l) => void (l.text = l.text.toUpperCase()))}>
              MAYÚSCULAS
            </Button>
            <Button size="sm" variant="soft" onClick={() => set((l) => void (l.text = l.text.toLowerCase()))}>
              minúsculas
            </Button>
          </div>

          <Section title="Fuente">
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {['todas', 'divertida', 'meme', 'manuscrita', 'elegante', 'retro', 'básica'].map((c) => (
                <Chip key={c} active={fontCat === c} onClick={() => setFontCat(c)}>
                  {c[0].toUpperCase() + c.slice(1)}
                </Chip>
              ))}
            </div>
            <div className="scroll-thin grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
              {fonts.map((f) => (
                <button
                  key={f.family}
                  onClick={() => set((l) => void (l.fontFamily = f.family))}
                  className={cn(
                    'truncate rounded-xl border-2 px-2 py-2 text-left text-[15px] transition-colors cursor-pointer',
                    layer.fontFamily === f.family ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/40',
                  )}
                  style={{ fontFamily: `"${f.family}"` }}
                  title={f.family}
                >
                  {f.family}
                </button>
              ))}
            </div>
          </Section>

          <Slider label="Tamaño" value={layer.fontSize} min={16} max={200} onChange={(v) => set((l) => void (l.fontSize = v), 'size')} />
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" icon={Bold} variant={layer.bold ? 'soft' : 'secondary'} onClick={() => set((l) => void (l.bold = !l.bold))} aria-pressed={layer.bold}>
              Negrita
            </Button>
            <Button size="sm" icon={Italic} variant={layer.italic ? 'soft' : 'secondary'} onClick={() => set((l) => void (l.italic = !l.italic))} aria-pressed={layer.italic}>
              Cursiva
            </Button>
          </div>
          <Segmented
            label="Alineación"
            value={layer.align}
            onChange={(v) => set((l) => void (l.align = v))}
            options={[
              { value: 'left', label: <AlignLeft className="size-4" />, title: 'Izquierda' },
              { value: 'center', label: <AlignCenter className="size-4" />, title: 'Centro' },
              { value: 'right', label: <AlignRight className="size-4" />, title: 'Derecha' },
            ]}
          />

          <Section title="Color">
            <Toggle label="Degradado" checked={!!layer.gradient} onChange={(v) => set((l) => void (l.gradient = v ? { from: '#ff5d8f', to: '#748ffc', angle: 0 } : null))} />
            {layer.gradient ? (
              <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
                <ColorField label="Desde" value={layer.gradient.from} onChange={(c) => set((l) => void (l.gradient!.from = c), 'gf')} />
                <ColorField label="Hasta" value={layer.gradient.to} onChange={(c) => set((l) => void (l.gradient!.to = c), 'gt')} />
                <Slider label="Ángulo" value={layer.gradient.angle} min={0} max={360} format={(v) => `${v}°`} onChange={(v) => set((l) => void (l.gradient!.angle = v), 'ga')} />
              </div>
            ) : (
              <ColorField label="Relleno" value={layer.fill} onChange={(c) => set((l) => void (l.fill = c), 'fill')} />
            )}
          </Section>

          <Section title="Contorno">
            <ColorField label="Color del contorno" value={layer.stroke} onChange={(c) => set((l) => void (l.stroke = c), 'stroke')} />
            <Slider label="Grosor" value={layer.strokeWidth} min={0} max={30} onChange={(v) => set((l) => void (l.strokeWidth = v), 'sw')} />
          </Section>

          <ShadowControls value={layer.shadow} onChange={(p, k) => set((l) => void Object.assign(l.shadow, p), k)} />

          <Section title="Forma del texto">
            <Slider label="Curva" value={layer.curve} min={-100} max={100} onChange={(v) => set((l) => void (l.curve = v), 'curve')} format={(v) => (v === 0 ? 'recto' : `${v}`)} />
            <Slider label="Espaciado" value={layer.letterSpacing} min={-5} max={30} onChange={(v) => set((l) => void (l.letterSpacing = v), 'ls')} />
            <Slider label="Interlineado" value={Math.round(layer.lineHeight * 100)} min={70} max={200} format={(v) => (v / 100).toFixed(2)} onChange={(v) => set((l) => void (l.lineHeight = v / 100), 'lh')} />
            <Slider label="Ancho de caja" value={layer.width} min={80} max={512} onChange={(v) => set((l) => void (l.width = v), 'tw')} />
          </Section>
        </>
      )}
    </div>
  )
}
