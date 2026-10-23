import { Scissors } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ProgressBar, Slider } from '@/components/ui/Controls'
import { importVideoRange } from '@/lib/import/media'
import { toast } from '@/store/ui'
import { addMediaLayer, useImport } from './useImport'

export function VideoImportDialog() {
  const file = useImport((s) => s.video)
  const close = useImport((s) => s.closeVideo)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(3)
  const [fps, setFps] = useState(12)
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    if (!file) return
    const u = URL.createObjectURL(file)
    setUrl(u)
    setProgress(null)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const onMeta = () => {
    const v = videoRef.current!
    setDuration(v.duration)
    setStart(0)
    setEnd(Math.min(v.duration, 4))
  }

  // Vista previa en bucle del tramo elegido
  useEffect(() => {
    const v = videoRef.current
    if (!v || progress !== null) return
    const loop = () => {
      if (v.currentTime >= end || v.currentTime < start) v.currentTime = start
    }
    v.addEventListener('timeupdate', loop)
    v.currentTime = start
    void v.play().catch(() => {})
    return () => v.removeEventListener('timeupdate', loop)
  }, [start, end, progress])

  const len = Math.max(0, end - start)
  const run = async () => {
    const v = videoRef.current!
    setProgress(0)
    try {
      const media = await importVideoRange(v, start, end, fps, setProgress)
      addMediaLayer(media)
      toast('Vídeo convertido en animación 🎬', 'success')
      close()
    } catch (e) {
      console.error(e)
      toast('No se pudo procesar el vídeo.', 'error')
      setProgress(null)
    }
  }

  return (
    <Modal
      open={!!file}
      onClose={close}
      title="Recortar vídeo"
      size="lg"
      dismissable={progress === null}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={progress !== null}>
            Cancelar
          </Button>
          <Button variant="primary" icon={Scissors} onClick={() => void run()} loading={progress !== null} disabled={len <= 0.2}>
            Convertir {len.toFixed(1)} s
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="checker overflow-hidden rounded-3xl">
          {url && <video ref={videoRef} src={url} className="mx-auto max-h-72 w-full object-contain" muted playsInline onLoadedMetadata={onMeta} />}
        </div>
        {progress !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">Extrayendo fotogramas… {Math.round(progress * 100)}%</p>
            <ProgressBar value={progress} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Slider label="Inicio" value={start} min={0} max={Math.max(0.1, duration)} step={0.1} format={(v) => `${v.toFixed(1)} s`} onChange={(v) => {
              setStart(v)
              if (end - v > 10) setEnd(v + 10)
              if (end <= v) setEnd(Math.min(duration, v + 1))
            }} />
            <Slider label="Fin" value={end} min={0} max={Math.max(0.1, duration)} step={0.1} format={(v) => `${v.toFixed(1)} s`} onChange={(v) => {
              setEnd(Math.max(start + 0.2, v))
              if (v - start > 10) setStart(v - 10)
            }} />
            <Slider label="Fotogramas por segundo" value={fps} min={8} max={30} onChange={setFps} format={(v) => `${v} FPS`} />
            <p className="self-end text-xs text-muted">WhatsApp admite animaciones de hasta 10 s. Menos FPS = archivo más ligero.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
