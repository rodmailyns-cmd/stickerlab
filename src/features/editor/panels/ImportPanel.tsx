import { motion } from 'framer-motion'
import { Camera, Clipboard, Film, ImagePlus, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Section } from '@/components/ui/Controls'
import { useImport } from '../useImport'
import { toast } from '@/store/ui'
import { isNative } from '@/lib/native/platform'

export function ImportPanel() {
  const input = useRef<HTMLInputElement>(null)
  const { busy, importFiles, setCameraOpen } = useImport()

  const openCamera = async () => {
    if (!isNative) return setCameraOpen(true)
    try {
      const { takeNativePhoto } = await import('@/lib/native/media')
      const f = await takeNativePhoto()
      if (f) await importFiles([f])
    } catch (e) {
      console.error(e)
      toast('No se pudo abrir la cámara. Revisa el permiso de cámara de StickerLab en Ajustes.', 'error')
    }
  }

  const pasteFromClipboard = async () => {
    if (isNative) {
      try {
        const { readClipboardImage } = await import('@/lib/native/media')
        const f = await readClipboardImage()
        if (f) await importFiles([f])
        else toast('No hay ninguna imagen en el portapapeles.', 'info')
      } catch {
        toast('No se pudo leer el portapapeles.', 'error')
      }
      return
    }
    try {
      const items = await navigator.clipboard.read()
      const files: File[] = []
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith('image/'))
        if (type) files.push(new File([await it.getType(type)], 'portapapeles.png', { type }))
      }
      if (files.length) await importFiles(files)
      else toast('No hay ninguna imagen en el portapapeles.', 'info')
    } catch {
      toast('Pulsa Ctrl+V (o ⌘+V) sobre el editor para pegar.', 'info')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Section title="Añade tu imagen">
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => input.current?.click()}
          disabled={busy}
          className="group flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-accent/40 bg-accent-soft/50 px-4 py-7 text-center transition-colors hover:border-accent cursor-pointer"
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-soft transition-transform group-hover:rotate-6">
            {busy ? <span className="size-6 rounded-full border-3 border-white border-t-transparent animate-spin" /> : <Upload className="size-7" />}
          </span>
          <span className="font-display text-lg font-semibold">{busy ? 'Procesando…' : 'Arrastra o elige un archivo'}</span>
          <span className="text-xs text-muted">Imágenes, GIF animados y vídeos cortos</span>
        </motion.button>
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void importFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button icon={Camera} onClick={() => void openCamera()}>
            Cámara
          </Button>
          <Button icon={Clipboard} onClick={() => void pasteFromClipboard()}>
            Pegar
          </Button>
        </div>
      </Section>
      <div className="grid gap-2 rounded-3xl bg-surface-2 p-4 text-sm text-muted">
        <p className="flex items-center gap-2">
          <ImagePlus className="size-4 shrink-0 text-accent" /> Suelta imágenes en cualquier parte del editor.
        </p>
        <p className="flex items-center gap-2">
          <Clipboard className="size-4 shrink-0 text-accent-2" /> Pega con <kbd className="rounded bg-surface px-1.5 font-bold">Ctrl</kbd>+<kbd className="rounded bg-surface px-1.5 font-bold">V</kbd>.
        </p>
        <p className="flex items-center gap-2">
          <Film className="size-4 shrink-0 text-mint" /> Los GIF y vídeos se convierten en stickers animados.
        </p>
      </div>
    </div>
  )
}
