import { RotateCcw } from 'lucide-react'
import { DEFAULT_FILTERS, type FilterSettings } from '@/types/doc'
import { Button } from '@/components/ui/Button'
import { Section, Slider, Toggle } from '@/components/ui/Controls'
import { cn } from '@/components/ui/cn'
import { FILTER_PRESETS } from '@/lib/render/filters'
import { useEditor } from '@/store/editor'
import { NeedSelection, useSelectedLayer } from './common'

const PRESET_STYLE: Record<string, string> = {
  none: 'linear-gradient(135deg,#ffd6e8,#d7c8ff)',
  vivid: 'linear-gradient(135deg,#ff2d8a,#7a3cff)',
  bw: 'linear-gradient(135deg,#eee,#333)',
  pop: 'repeating-linear-gradient(45deg,#ff2d8a 0 10px,#ffe600 10px 20px,#00c2ff 20px 30px)',
  pixel: 'conic-gradient(#ff8fc8 25%,#b69cff 0 50%,#ff8fc8 0 75%,#b69cff 0) 0 0/16px 16px',
  vignette: 'radial-gradient(circle,#ffe3f1 30%,#3a2a4a)',
  glitch: 'linear-gradient(90deg,#ff004c 0 33%,#00ffd5 33% 66%,#7a3cff 66%)',
  soft: 'linear-gradient(135deg,#fff3f8,#efe8ff)',
}

export function FiltersPanel() {
  const sel = useSelectedLayer()
  const selection = useEditor((s) => s.selection)
  const updateSelected = useEditor((s) => s.updateSelected)
  const select = useEditor((s) => s.select)
  const layers = useEditor((s) => s.doc.layers)

  if (!sel) {
    return (
      <div className="flex flex-col gap-3">
        <NeedSelection text="Selecciona una o varias capas para aplicarles filtros y ajustes." />
        {layers.length > 0 && (
          <Button size="sm" onClick={() => select(layers.map((l) => l.id))}>
            Seleccionar todas las capas
          </Button>
        )}
      </div>
    )
  }
  const f = sel.filters
  const set = (patch: Partial<FilterSettings>, key: string) => updateSelected((l) => void Object.assign(l.filters, patch), { coalesce: `f-${key}-${selection.join()}` })

  return (
    <div className="flex flex-col gap-5">
      <Section title="Filtros rápidos">
        <div className="grid grid-cols-4 gap-2">
          {FILTER_PRESETS.map((p) => (
            <button key={p.id} onClick={() => updateSelected((l) => void (l.filters = { ...DEFAULT_FILTERS, ...p.settings }))} className="group flex flex-col items-center gap-1 cursor-pointer">
              <span className={cn('aspect-square w-full rounded-2xl border border-line transition-transform group-hover:-translate-y-0.5')} style={{ background: PRESET_STYLE[p.id] }} />
              <span className="text-[11px] font-bold">{p.label}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section
        title="Ajustes"
        action={
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => updateSelected((l) => void (l.filters = { ...DEFAULT_FILTERS }))}>
            Restablecer
          </Button>
        }
      >
        <Slider label="Brillo" value={Math.round(f.brightness * 100)} min={-100} max={100} onChange={(v) => set({ brightness: v / 100 }, 'b')} />
        <Slider label="Contraste" value={f.contrast} min={-100} max={100} onChange={(v) => set({ contrast: v }, 'c')} />
        <Slider label="Saturación" value={Math.round(f.saturation * 100)} min={-100} max={100} onChange={(v) => set({ saturation: v / 100 }, 's')} />
        <Slider label="Pixelado" value={f.pixelate} min={0} max={40} onChange={(v) => set({ pixelate: v }, 'p')} format={(v) => (v > 1 ? `${v}` : 'no')} />
        <Slider label="Viñeta" value={Math.round(f.vignette * 100)} min={0} max={100} onChange={(v) => set({ vignette: v / 100 }, 'v')} />
        <Slider label="Glitch" value={Math.round(f.glitch * 100)} min={0} max={100} onChange={(v) => set({ glitch: v / 100 }, 'g')} />
        <Toggle label="Blanco y negro" checked={f.grayscale} onChange={(v) => set({ grayscale: v }, 'gs')} />
        <Toggle label="Pop-art" checked={f.popArt} onChange={(v) => set({ popArt: v }, 'pa')} />
      </Section>
    </div>
  )
}
