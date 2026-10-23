import { CheckCircle2, Download, Images, PackagePlus, Save, Share2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Controls'
import { LoadingCard } from '@/components/illustrations/Illustrations'
import { exportSticker, type ExportProgress } from '@/lib/render/exporter'
import { formatBytes, maxBytesFor, safeFileName } from '@/lib/export/limits'
import { splitEmojis } from '@/lib/export/validator'
import { uid } from '@/lib/doc/factory'
import type { StickerRecord } from '@/lib/storage/db'
import { saveFile, shareFiles } from '@/lib/download'
import { useEditor } from '@/store/editor'
import { useLibrary } from '@/store/library'
import { toast, useUi } from '@/store/ui'
import { haptic } from '@/lib/native/haptics'
import { AddToPackMenu } from '../packs/AddToPackMenu'

const QUICK_EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '😭', '😡', '👍', '❤️', '🎉', '🔥', '✨']

const STAGE_LABEL: Record<ExportProgress['stage'], string> = {
  preparando: 'Preparando el lienzo…',
  renderizando: 'Dibujando fotogramas…',
  codificando: 'Convirtiendo a WebP…',
  optimizando: 'Optimizando para WhatsApp…',
  listo: '¡Listo!',
}

export function SaveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditor((s) => s.doc)
  const stickerId = useEditor((s) => s.stickerId)
  const existing = useLibrary((s) => s.stickers.find((x) => x.id === stickerId))
  const saveSticker = useLibrary((s) => s.saveSticker)
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [emojis, setEmojis] = useState('')
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [saved, setSaved] = useState<StickerRecord | null>(null)

  // Rellena el formulario solo al abrir (no cuando el sticker se acaba de guardar)
  useEffect(() => {
    if (!open) return
    const st = useEditor.getState()
    const ex = useLibrary.getState().stickers.find((x) => x.id === st.stickerId)
    setName(ex?.name ?? st.doc.name)
    setTags(ex?.tags.join(', ') ?? '')
    setEmojis(ex?.emojis.join('') ?? '😀')
    setProgress(null)
    setSaved(null)
  }, [open])

  const url = useMemo(() => (saved ? URL.createObjectURL(saved.webp) : null), [saved])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  const run = async (asNew: boolean) => {
    if (!doc.layers.length) {
      toast('El sticker está vacío. Añade una imagen, texto o emoji.', 'error')
      return
    }
    setProgress({ stage: 'preparando', progress: 0 })
    try {
      const res = await exportSticker(doc, { onProgress: setProgress })
      const now = Date.now()
      const id = !asNew && existing ? existing.id : uid()
      const rec: StickerRecord = {
        id,
        name: name.trim() || 'Sticker',
        tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        favorite: (!asNew && existing?.favorite) || false,
        animated: res.animated,
        emojis: splitEmojis(emojis).slice(0, 3),
        doc: { ...structuredClone(doc), name: name.trim() || doc.name },
        webp: new Blob([res.data as BlobPart], { type: 'image/webp' }),
        bytes: res.data.length,
        params: res.params,
        createdAt: !asNew && existing ? existing.createdAt : now,
        updatedAt: now,
      }
      await saveSticker(rec)
      useEditor.getState().markSaved(id)
      setSaved(rec)
      haptic(res.withinLimit ? 'success' : 'warning')
      if (!res.withinLimit) toast('No se pudo bajar del límite de WhatsApp. Simplifica el sticker o acorta la animación.', 'error')
    } catch (e) {
      console.error(e)
      toast('Algo falló al generar el sticker.', 'error')
    } finally {
      setProgress(null)
    }
  }

  const fileName = `${safeFileName(saved?.name ?? 'sticker')}.webp`
  const max = maxBytesFor(doc.animated)

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissable={!progress}
      title={saved ? '¡Sticker guardado!' : 'Guardar sticker'}
      footer={
        saved ? (
          <>
            <Button variant="ghost" icon={Images} onClick={() => { onClose(); useUi.getState().setPage('library') }}>
              Ver biblioteca
            </Button>
            <Button variant="primary" onClick={onClose}>
              Seguir creando
            </Button>
          </>
        ) : (
          !progress && (
            <>
              {existing && (
                <Button variant="ghost" onClick={() => void run(true)}>
                  Guardar como nuevo
                </Button>
              )}
              <Button variant="primary" icon={Save} onClick={() => void run(false)}>
                {existing ? 'Actualizar sticker' : 'Guardar sticker'}
              </Button>
            </>
          )
        )
      }
    >
      {progress ? (
        <LoadingCard label={STAGE_LABEL[progress.stage]} progress={progress.progress} detail={progress.detail} />
      ) : saved && url ? (
        <div className="flex flex-col items-center gap-4">
          <div className="checker size-48 overflow-hidden rounded-3xl shadow-soft">
            <img src={url} alt={saved.name} className="size-full object-contain" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-bold">
            <span className="flex items-center gap-1 rounded-full bg-ok/15 px-3 py-1 text-ok">
              <CheckCircle2 className="size-4" /> {formatBytes(saved.bytes)} de {formatBytes(max)}
            </span>
            <span className="rounded-full bg-surface-3 px-3 py-1">{saved.animated ? `Animado · ${saved.params.fps} FPS` : 'Estático'} · 512×512</span>
            <span className="rounded-full bg-surface-3 px-3 py-1">calidad {saved.params.quality}{saved.params.colors ? ` · ${saved.params.colors} niveles` : ''}</span>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            <Button icon={Download} onClick={() => void saveFile(saved.webp, fileName)}>
              .webp
            </Button>
            <Button
              icon={Share2}
              onClick={() =>
                void shareFiles([new File([saved.webp], fileName, { type: 'image/webp' })], saved.name).then((ok) => !ok && toast('Compartir no está disponible en este navegador. Descarga el archivo.', 'info'))
              }
            >
              Compartir
            </Button>
            <AddToPackMenu sticker={saved}>
              <Button icon={PackagePlus} variant="soft" className="w-full">
                A un pack
              </Button>
            </AddToPackMenu>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <TextInput label="Nombre" value={name} onChange={setName} maxLength={60} />
          <TextInput label="Etiquetas (separadas por comas)" value={tags} onChange={setTags} placeholder="gatos, risa, familia" />
          <div className="flex flex-col gap-2">
            <TextInput label="Emojis asociados (hasta 3, para buscarlo en WhatsApp)" value={emojis} onChange={(v) => setEmojis(splitEmojis(v).slice(0, 3).join(''))} />
            <div className="flex flex-wrap gap-1">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmojis(splitEmojis(emojis + e).slice(-3).join(''))}
                  className="rounded-xl p-1.5 text-xl hover:bg-surface-3 cursor-pointer"
                  aria-label={`Añadir ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <p className="rounded-2xl bg-surface-2 p-3 text-xs text-muted">
            Se exportará como <b>{doc.animated ? 'WebP animado' : 'WebP estático'}</b> de 512×512 con fondo transparente, por debajo de {formatBytes(max)}
            {doc.animated ? ` y ${Math.min(10, doc.duration).toFixed(1)} s en bucle` : ''}. Si pesa más, StickerLab lo optimiza solo.
          </p>
        </div>
      )}
    </Modal>
  )
}
