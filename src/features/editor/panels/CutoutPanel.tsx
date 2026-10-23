import { Circle, Eraser, Heart, Lasso, MousePointer2, Paintbrush, RotateCcw, Square, Star, Wand2, X } from 'lucide-react'
import { useState } from 'react'
import type { CropShape, ImageLayer } from '@/types/doc'
import { Button } from '@/components/ui/Button'
import { ColorField, ProgressBar, Section, Segmented, Slider } from '@/components/ui/Controls'
import { cn } from '@/components/ui/cn'
import { removeBackgroundFromAsset } from '@/lib/bg/removeBackground'
import { useEditor } from '@/store/editor'
import { toast } from '@/store/ui'
import { NeedSelection, ShadowControls, useSelectedLayer } from './common'

const SHAPES: { id: CropShape; label: string; icon: typeof Circle }[] = [
  { id: 'none', label: 'Sin forma', icon: X },
  { id: 'circle', label: 'Círculo', icon: Circle },
  { id: 'rounded', label: 'Redondeado', icon: Square },
  { id: 'heart', label: 'Corazón', icon: Heart },
  { id: 'star', label: 'Estrella', icon: Star },
  { id: 'lasso', label: 'Lazo libre', icon: Lasso },
]

export function CutoutPanel() {
  const sel = useSelectedLayer()
  const img = sel?.type === 'image' ? sel : null
  const updateLayer = useEditor((s) => s.updateLayer)
  const setDoc = useEditor((s) => s.setDoc)
  const globalOutline = useEditor((s) => s.doc.globalOutline)
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const maskBrush = useEditor((s) => s.maskBrush)
  const setMaskBrush = useEditor((s) => s.setMaskBrush)
  const [bg, setBg] = useState<{ label: string; progress: number } | null>(null)

  const set = (r: (l: ImageLayer) => void, key?: string) => img && updateLayer<ImageLayer>(img.id, r as never, key ? { coalesce: `${img.id}-${key}` } : undefined)

  const removeBg = async () => {
    if (!img) return
    setBg({ label: 'Preparando…', progress: 0 })
    try {
      if (img.frames && img.frames.length > 1) {
        const out: string[] = []
        for (let i = 0; i < img.frames.length; i++) {
          out.push(await removeBackgroundFromAsset(img.frames[i].assetId, (p) => setBg({ label: `${p.label} Fotograma ${i + 1}/${img.frames!.length}`, progress: (i + p.progress) / img.frames!.length })))
        }
        set((l) => {
          l.originalAssetId = l.assetId
          l.frames = l.frames!.map((f, i) => ({ ...f, assetId: out[i] }))
          l.assetId = out[0]
          l.mask = []
        })
      } else {
        const id = await removeBackgroundFromAsset(img.assetId, (p) => setBg(p))
        set((l) => {
          l.originalAssetId = l.originalAssetId ?? l.assetId
          l.assetId = id
          l.mask = []
        })
      }
      toast('¡Fondo eliminado! Retoca con el borrador si hace falta ✨', 'success')
    } catch (e) {
      console.error(e)
      toast('No se pudo quitar el fondo. Prueba con una imagen más pequeña o reinicia la app.', 'error')
    } finally {
      setBg(null)
    }
  }

  const maskTool = tool === 'mask-erase' || tool === 'mask-restore' ? tool : 'select'

  return (
    <div className="flex flex-col gap-5">
      {!img ? (
        <NeedSelection text="Selecciona una imagen del lienzo para quitar el fondo, recortarla o añadirle contorno." />
      ) : (
        <>
          <Section title="Quitar fondo">
            {bg ? (
              <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
                <p className="text-sm font-bold">{bg.label}</p>
                <ProgressBar value={bg.progress} />
              </div>
            ) : (
              <Button variant="primary" icon={Wand2} onClick={() => void removeBg()}>
                {img.originalAssetId ? 'Volver a quitar el fondo' : 'Quitar fondo automático'}
              </Button>
            )}
            {img.originalAssetId && (
              <Button
                size="sm"
                variant="ghost"
                icon={RotateCcw}
                onClick={() =>
                  set((l) => {
                    if (l.frames) l.frames = null
                    l.assetId = l.originalAssetId!
                    l.originalAssetId = null
                    l.mask = []
                  })
                }
              >
                Recuperar imagen original
              </Button>
            )}
          </Section>

          <Section title="Retocar recorte">
            <Segmented
              label="Pincel de recorte"
              value={maskTool}
              onChange={(v) => setTool(v)}
              options={[
                { value: 'select', label: <><MousePointer2 className="size-4" /> Mover</> },
                { value: 'mask-erase', label: <><Eraser className="size-4" /> Borrar</> },
                { value: 'mask-restore', label: <><Paintbrush className="size-4" /> Restaurar</> },
              ]}
            />
            {maskTool === 'mask-restore' && !img.originalAssetId && <p className="text-xs text-muted">"Restaurar" recupera zonas borradas tras quitar el fondo.</p>}
            <Slider label="Tamaño del pincel" value={maskBrush} min={4} max={120} onChange={setMaskBrush} format={(v) => `${v} px`} />
            {img.mask.length > 0 && (
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => set((l) => void (l.mask = []))}>
                Quitar retoques ({img.mask.length})
              </Button>
            )}
          </Section>

          <Section title="Forma de recorte">
            <div className="grid grid-cols-3 gap-2">
              {SHAPES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    if (id === 'lasso') {
                      setTool('lasso')
                      toast('Dibuja el contorno sobre la imagen con el dedo o el ratón', 'info')
                    } else set((l) => void (l.crop = { ...l.crop, shape: id }))
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl border-2 px-1 py-2.5 text-xs font-bold transition-colors cursor-pointer',
                    img.crop.shape === id || (id === 'lasso' && tool === 'lasso') ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface hover:border-accent/40',
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </button>
              ))}
            </div>
            {img.crop.shape === 'rounded' && <Slider label="Redondeo" value={img.crop.radius} min={0} max={100} onChange={(v) => set((l) => void (l.crop.radius = v), 'radius')} />}
          </Section>

          <Section title="Contorno tipo sticker">
            <Slider label="Grosor" value={img.outline.width} min={0} max={30} onChange={(v) => set((l) => void (l.outline.width = v), 'ow')} format={(v) => (v ? `${v} px` : 'sin contorno')} />
            {img.outline.width > 0 && <ColorField label="Color del contorno" value={img.outline.color} onChange={(c) => set((l) => void (l.outline.color = c), 'oc')} />}
            <ShadowControls value={img.shadow} onChange={(p, k) => set((l) => void Object.assign(l.shadow, p), k)} />
          </Section>
        </>
      )}

      <Section title="Contorno de todo el sticker">
        <p className="-mt-1 text-xs text-muted">Une imagen, texto y decoraciones con un borde común, como un sticker troquelado.</p>
        <Slider
          label="Grosor"
          value={globalOutline.width}
          min={0}
          max={30}
          onChange={(v) => setDoc((d) => void (d.globalOutline.width = v), { coalesce: 'g-ow' })}
          format={(v) => (v ? `${v} px` : 'sin contorno')}
        />
        {globalOutline.width > 0 && (
          <ColorField label="Color" value={globalOutline.color} onChange={(c) => setDoc((d) => void (d.globalOutline.color = c), { coalesce: 'g-oc' })} />
        )}
        <ShadowControls value={globalOutline.shadow} onChange={(p, k) => setDoc((d) => void Object.assign(d.globalOutline.shadow, p), { coalesce: `g-${k}` })} />
      </Section>
    </div>
  )
}
