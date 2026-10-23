import { create } from 'zustand'
import { importImageFile, isAcceptedFile, type ImportedMedia } from '@/lib/import/media'
import { newImageLayer } from '@/lib/doc/factory'
import { useEditor } from '@/store/editor'
import { toast } from '@/store/ui'

/** Añade un medio importado como capa nueva (y ajusta la animación si es GIF/vídeo). */
export function addMediaLayer(m: ImportedMedia) {
  const st = useEditor.getState()
  const layer = newImageLayer(m.assetId, m.width, m.height, m.frames, m.name)
  st.addLayer(layer)
  if (m.frames && m.frames.length > 1) {
    const seconds = Math.min(10, Math.max(0.5, m.durationMs / 1000))
    const avg = m.durationMs / m.frames.length
    st.setDoc((d) => {
      d.animated = true
      d.duration = Math.round(seconds * 10) / 10
      d.fps = Math.max(8, Math.min(30, Math.round(1000 / Math.max(1, avg))))
    })
  }
  st.setTool('select')
}

interface ImportState {
  busy: boolean
  video: File | null
  cameraOpen: boolean
  setCameraOpen: (o: boolean) => void
  closeVideo: () => void
  importFiles: (files: File[] | FileList) => Promise<void>
}

/** Importación de archivos: imágenes y GIF directamente; los vídeos abren el recortador. */
export const useImport = create<ImportState>()((set) => ({
  busy: false,
  video: null,
  cameraOpen: false,
  setCameraOpen: (cameraOpen) => set({ cameraOpen }),
  closeVideo: () => set({ video: null }),
  importFiles: async (files) => {
    const list = [...files]
    const vid = list.find((f) => isAcceptedFile(f) === 'video')
    if (vid) set({ video: vid })
    const images = list.filter((f) => isAcceptedFile(f) === 'image')
    if (!images.length) {
      if (!vid) toast('Ese archivo no es una imagen ni un vídeo compatible.', 'error')
      return
    }
    set({ busy: true })
    try {
      for (const f of images) addMediaLayer(await importImageFile(f, f.name.replace(/\.[^.]+$/, '').slice(0, 30) || 'Imagen'))
      toast(images.length > 1 ? `${images.length} imágenes añadidas` : 'Imagen añadida ✨', 'success')
    } catch (e) {
      console.error(e)
      toast('No se pudo abrir la imagen.', 'error')
    } finally {
      set({ busy: false })
    }
  },
}))
