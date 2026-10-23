import { Aperture, FlipHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { captureFromVideo } from '@/lib/import/media'
import { toast } from '@/store/ui'
import { addMediaLayer, useImport } from './useImport'

export function CameraDialog() {
  const open = useImport((s) => s.cameraOpen)
  const setOpen = useImport((s) => s.setCameraOpen)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null
    setError(null)
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          void videoRef.current.play()
        }
      })
      .catch(() => setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.'))
    if (!navigator.mediaDevices) setError('Tu navegador no permite usar la cámara aquí.')
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [open, facing])

  const shoot = async () => {
    if (!videoRef.current) return
    setBusy(true)
    try {
      addMediaLayer(await captureFromVideo(videoRef.current, facing === 'user'))
      toast('¡Foto lista! Prueba a quitarle el fondo ✂️', 'success')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Hacer una foto"
      footer={
        <>
          <Button icon={FlipHorizontal} variant="ghost" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
            Cambiar cámara
          </Button>
          <Button icon={Aperture} variant="primary" onClick={() => void shoot()} loading={busy} disabled={!!error}>
            Capturar
          </Button>
        </>
      }
    >
      <div className="checker grid aspect-square place-items-center overflow-hidden rounded-3xl">
        {error ? (
          <p className="p-6 text-center text-sm font-bold text-danger">{error}</p>
        ) : (
          <video ref={videoRef} className="size-full object-cover" style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} muted playsInline />
        )}
      </div>
    </Modal>
  )
}
