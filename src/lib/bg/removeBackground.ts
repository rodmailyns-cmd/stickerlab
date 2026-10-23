import { createAsset } from '../render/assets'
import { getAsset } from '../storage/db'

export interface BgProgress {
  label: string
  progress: number
}

/**
 * Quita el fondo en el dispositivo con @imgly/background-removal (ONNX + WASM).
 * El modelo se sirve desde la propia app (public/imgly, copiado por scripts/copy-bg-model.mjs),
 * así que funciona sin internet, también dentro del APK.
 */
export async function removeBackgroundFromAsset(assetId: string, onProgress?: (p: BgProgress) => void): Promise<string> {
  const asset = await getAsset(assetId)
  if (!asset) throw new Error('No se encontró la imagen')
  const { removeBackground } = await import('@imgly/background-removal')
  const blob = await removeBackground(asset.blob, {
    publicPath: new URL(`${import.meta.env.BASE_URL}imgly/`, document.baseURI).href,
    model: 'small',
    proxyToWorker: false,
    output: { format: 'image/png' },
    progress: (key: string, current: number, total: number) => {
      const label = key.startsWith('fetch') ? 'Cargando el modelo de IA…' : 'Recortando…'
      onProgress?.({ label, progress: total ? current / total : 0 })
    },
  })
  const out = await createAsset(blob)
  return out.id
}
