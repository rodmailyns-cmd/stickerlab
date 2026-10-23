import type { Shadow } from '@/types/doc'
import { ColorField, Slider, Toggle } from '@/components/ui/Controls'
import { useEditor } from '@/store/editor'
import type { Layer } from '@/types/doc'
import { Mascot } from '@/components/illustrations/Illustrations'

export function useSelectedLayer(): Layer | null {
  return useEditor((s) => s.doc.layers.find((l) => s.selection.includes(l.id)) ?? null)
}

export function ShadowControls({ value, onChange }: { value: Shadow; onChange: (patch: Partial<Shadow>, key: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Toggle label="Sombra" checked={value.enabled} onChange={(v) => onChange({ enabled: v }, 'shadow-on')} />
      {value.enabled && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
          <ColorField label="Color de sombra" value={value.color} onChange={(c) => onChange({ color: c }, 'shadow-color')} />
          <Slider label="Difuminado" value={value.blur} min={0} max={40} onChange={(v) => onChange({ blur: v }, 'shadow-blur')} />
          <Slider label="Desplazamiento X" value={value.offsetX} min={-30} max={30} onChange={(v) => onChange({ offsetX: v }, 'shadow-x')} />
          <Slider label="Desplazamiento Y" value={value.offsetY} min={-30} max={30} onChange={(v) => onChange({ offsetY: v }, 'shadow-y')} />
          <Slider label="Opacidad" value={Math.round(value.opacity * 100)} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => onChange({ opacity: v / 100 }, 'shadow-o')} />
        </div>
      )}
    </div>
  )
}

export function NeedSelection({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-surface-2 px-4 py-6 text-center">
      <Mascot mood="wink" size={80} />
      <p className="text-sm font-semibold text-muted">{text}</p>
    </div>
  )
}
