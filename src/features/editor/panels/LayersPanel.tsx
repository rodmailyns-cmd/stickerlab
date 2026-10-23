import { Reorder } from 'framer-motion'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  Brush,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Group,
  Image as ImageIcon,
  Lock,
  Shapes,
  Smile,
  Trash2,
  Type,
  Ungroup,
  Unlock,
} from 'lucide-react'
import { useState } from 'react'
import type { BlendMode, Layer } from '@/types/doc'
import { IconButton } from '@/components/ui/Button'
import { Section, Slider } from '@/components/ui/Controls'
import { cn } from '@/components/ui/cn'
import { EmptyState } from '@/components/illustrations/Illustrations'
import { useEditor } from '@/store/editor'

const BLENDS: { value: BlendMode; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiplicar' },
  { value: 'screen', label: 'Trama' },
  { value: 'overlay', label: 'Superponer' },
  { value: 'darken', label: 'Oscurecer' },
  { value: 'lighten', label: 'Aclarar' },
  { value: 'color-dodge', label: 'Sobreexponer' },
  { value: 'color-burn', label: 'Subexponer' },
  { value: 'hard-light', label: 'Luz fuerte' },
  { value: 'soft-light', label: 'Luz suave' },
  { value: 'difference', label: 'Diferencia' },
  { value: 'exclusion', label: 'Exclusión' },
  { value: 'hue', label: 'Tono' },
  { value: 'saturation', label: 'Saturación' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosidad' },
]

const ICONS = { image: ImageIcon, text: Type, shape: Shapes, emoji: Smile, draw: Brush }

function LayerRow({ layer, selected }: { layer: Layer; selected: boolean }) {
  const { select, updateLayer } = useEditor.getState()
  const selection = useEditor((s) => s.selection)
  const [editing, setEditing] = useState(false)
  const Icon = ICONS[layer.type]
  return (
    <Reorder.Item
      value={layer.id}
      className={cn(
        'flex cursor-grab items-center gap-2 rounded-2xl border-2 px-2 py-1.5 active:cursor-grabbing',
        selected ? 'border-accent bg-accent-soft' : 'border-transparent bg-surface-2 hover:border-line',
        !layer.visible && 'opacity-60',
      )}
      whileDrag={{ scale: 1.03, boxShadow: '0 10px 30px -10px rgba(0,0,0,.3)' }}
      onClick={(e) => {
        const add = e.shiftKey || e.metaKey || e.ctrlKey
        select(add ? (selection.includes(layer.id) ? selection.filter((x) => x !== layer.id) : [...selection, layer.id]) : [layer.id])
      }}
    >
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl', selected ? 'bg-white/70 dark:bg-black/20' : 'bg-surface')}>
        {layer.type === 'emoji' ? <span className="text-lg">{layer.emoji}</span> : <Icon className="size-4" />}
      </span>
      {editing ? (
        <input
          autoFocus
          defaultValue={layer.name}
          aria-label="Nombre de la capa"
          className="min-w-0 flex-1 rounded-lg bg-surface px-2 py-0.5 text-sm font-bold outline-none ring-2 ring-accent"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur()
          }}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v && v !== layer.name) updateLayer(layer.id, (l) => void (l.name = v))
            setEditing(false)
          }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-bold" onDoubleClick={() => setEditing(true)} title="Doble clic para renombrar">
          {layer.name}
          {layer.groupId && <span className="ml-1 rounded bg-accent-2/20 px-1 text-[10px] text-accent-2">grupo</span>}
        </span>
      )}
      <IconButton
        size="sm"
        icon={layer.visible ? Eye : EyeOff}
        label={layer.visible ? 'Ocultar' : 'Mostrar'}
        onClick={(e) => {
          e.stopPropagation()
          updateLayer(layer.id, (l) => void (l.visible = !l.visible))
        }}
      />
      <IconButton
        size="sm"
        icon={layer.locked ? Lock : Unlock}
        label={layer.locked ? 'Desbloquear' : 'Bloquear'}
        active={layer.locked}
        onClick={(e) => {
          e.stopPropagation()
          updateLayer(layer.id, (l) => void (l.locked = !l.locked))
        }}
      />
    </Reorder.Item>
  )
}

export function LayersPanel() {
  const layers = useEditor((s) => s.doc.layers)
  const selection = useEditor((s) => s.selection)
  const st = useEditor.getState()
  const ordered = [...layers].reverse()
  const sel = layers.filter((l) => selection.includes(l.id))
  const first = sel[0]

  if (!layers.length) {
    return <EmptyState title="Aún no hay capas" text="Importa una imagen, añade texto o decoraciones y aparecerán aquí." mood="happy" />
  }

  return (
    <div className="flex flex-col gap-4">
      <Reorder.Group
        axis="y"
        values={ordered.map((l) => l.id)}
        onReorder={(ids: string[]) => {
          const next = [...ids].reverse()
          st.setDoc((d) => void d.layers.sort((a, b) => next.indexOf(a.id) - next.indexOf(b.id)), { coalesce: 'reorder' })
        }}
        className="flex flex-col gap-1.5"
      >
        {ordered.map((l) => (
          <LayerRow key={l.id} layer={l} selected={selection.includes(l.id)} />
        ))}
      </Reorder.Group>

      {first && (
        <>
          <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-surface-2 p-1.5">
            <IconButton size="sm" icon={ArrowUp} label="Traer adelante (])" onClick={() => sel.forEach((l) => st.shiftLayer(l.id, 1))} />
            <IconButton size="sm" icon={ArrowDown} label="Enviar atrás ([)" onClick={() => sel.forEach((l) => st.shiftLayer(l.id, -1))} />
            <IconButton size="sm" icon={Copy} label="Duplicar (Ctrl+D)" onClick={() => st.duplicateLayers(selection)} />
            <IconButton size="sm" icon={FlipHorizontal2} label="Voltear horizontal" onClick={() => st.updateSelected((l) => void (l.scaleX *= -1))} />
            <IconButton size="sm" icon={FlipVertical2} label="Voltear vertical" onClick={() => st.updateSelected((l) => void (l.scaleY *= -1))} />
            <IconButton size="sm" icon={Group} label="Agrupar (Ctrl+G)" disabled={sel.length < 2} onClick={() => st.groupSelection()} />
            <IconButton size="sm" icon={Ungroup} label="Desagrupar (Ctrl+Shift+G)" disabled={!sel.some((l) => l.groupId)} onClick={() => st.ungroupSelection()} />
            <IconButton size="sm" icon={Trash2} label="Eliminar (Supr)" className="ml-auto text-danger" onClick={() => st.removeLayers(selection)} />
          </div>
          <div className="grid grid-cols-6 gap-1 rounded-2xl bg-surface-2 p-1.5" aria-label="Alinear en el lienzo">
            <IconButton size="sm" icon={AlignStartVertical} label="Alinear a la izquierda" onClick={() => st.alignSelection('left')} />
            <IconButton size="sm" icon={AlignCenterVertical} label="Centrar horizontalmente" onClick={() => st.alignSelection('centerX')} />
            <IconButton size="sm" icon={AlignEndVertical} label="Alinear a la derecha" onClick={() => st.alignSelection('right')} />
            <IconButton size="sm" icon={AlignStartHorizontal} label="Alinear arriba" onClick={() => st.alignSelection('top')} />
            <IconButton size="sm" icon={AlignCenterHorizontal} label="Centrar verticalmente" onClick={() => st.alignSelection('centerY')} />
            <IconButton size="sm" icon={AlignEndHorizontal} label="Alinear abajo" onClick={() => st.alignSelection('bottom')} />
          </div>
          <Section title="Apariencia">
            <Slider
              label="Opacidad"
              value={Math.round(first.opacity * 100)}
              min={0}
              max={100}
              format={(v) => `${v}%`}
              onChange={(v) => st.updateSelected((l) => void (l.opacity = v / 100), { coalesce: `op-${selection.join()}` })}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-muted">Modo de fusión</span>
              <select
                value={first.blend}
                onChange={(e) => st.updateSelected((l) => void (l.blend = e.target.value as BlendMode))}
                className="rounded-2xl border-2 border-line bg-surface px-3 py-2 text-sm font-bold focus:border-accent focus:outline-none cursor-pointer"
              >
                {BLENDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
          </Section>
        </>
      )}
    </div>
  )
}
