import { Brush, Eraser, MousePointer2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ColorField, Section, Segmented, Slider } from '@/components/ui/Controls'
import { newDrawLayer } from '@/lib/doc/factory'
import { useEditor } from '@/store/editor'
import { useSelectedLayer } from './common'

export function DrawPanel() {
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const brush = useEditor((s) => s.brush)
  const setBrush = useEditor((s) => s.setBrush)
  const addLayer = useEditor((s) => s.addLayer)
  const updateLayer = useEditor((s) => s.updateLayer)
  const sel = useSelectedLayer()
  const draw = sel?.type === 'draw' ? sel : null
  const value = tool === 'brush' || tool === 'eraser' ? tool : 'select'

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        label="Herramienta de dibujo"
        value={value}
        onChange={(v) => setTool(v)}
        options={[
          { value: 'select', label: <><MousePointer2 className="size-4" /> Mover</> },
          { value: 'brush', label: <><Brush className="size-4" /> Pincel</> },
          { value: 'eraser', label: <><Eraser className="size-4" /> Borrar</> },
        ]}
      />
      <ColorField label="Color del pincel" value={brush.color} onChange={(c) => setBrush({ color: c })} />
      <Slider label="Grosor" value={brush.size} min={2} max={80} onChange={(v) => setBrush({ size: v })} format={(v) => `${v} px`} />
      <div className="flex items-center justify-center rounded-3xl bg-surface-2 p-4">
        <span className="rounded-full" style={{ width: brush.size, height: brush.size, background: brush.color, boxShadow: '0 0 0 2px var(--border)' }} />
      </div>
      <Section title="Capa de dibujo">
        <p className="text-sm text-muted">
          {draw ? `Dibujando en "${draw.name}" (${draw.lines.length} trazos).` : 'Al pintar se crea una capa de dibujo nueva. El borrador solo afecta a la capa de dibujo seleccionada.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" icon={Plus} onClick={() => { addLayer(newDrawLayer()); setTool('brush') }}>
            Nueva capa
          </Button>
          <Button size="sm" icon={Trash2} disabled={!draw?.lines.length} onClick={() => draw && updateLayer(draw.id, (l) => void (l.type === 'draw' && (l.lines = [])))}>
            Limpiar
          </Button>
        </div>
      </Section>
    </div>
  )
}
