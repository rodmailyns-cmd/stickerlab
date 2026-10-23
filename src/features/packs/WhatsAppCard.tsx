import { App } from '@capacitor/app'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Send } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/Controls'
import { cn } from '@/components/ui/cn'
import { haptic } from '@/lib/native/haptics'
import { isNative } from '@/lib/native/platform'
import {
  errorCode,
  errorMessage,
  getWhatsAppStatus,
  isPackAdded,
  syncPackToDevice,
  WhatsAppStickers,
  WHATSAPP_PLAY_STORE,
  type WhatsAppStatus,
} from '@/lib/native/whatsapp'
import { toPackFiles } from '@/lib/packs/packs'
import type { PackRecord, StickerRecord } from '@/lib/storage/db'
import { useLibrary } from '@/store/library'
import { toast } from '@/store/ui'

type Phase = { kind: 'idle' } | { kind: 'working'; label: string; progress?: number } | { kind: 'error'; message: string }

/**
 * Integración nativa (solo en el APK): copia el pack al almacenamiento de la app, lanza el intent
 * oficial de WhatsApp y muestra si el pack ya está añadido.
 */
export function WhatsAppCard({ pack, stickers, blocking, checking }: { pack: PackRecord; stickers: StickerRecord[]; blocking: boolean; checking: boolean }) {
  const savePack = useLibrary((s) => s.savePack)
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [added, setAdded] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  // ¿Hay cambios (en el pack o en sus stickers) desde la última vez que se envió a WhatsApp?
  const lastChange = Math.max(pack.updatedAt, ...pack.items.map((i) => stickers.find((s) => s.id === i.stickerId)?.updatedAt ?? 0))
  const outdated = added && (pack.syncedAt ?? 0) < lastChange

  const refresh = useCallback(async () => {
    const [st, ad] = await Promise.all([getWhatsAppStatus(), isPackAdded(pack.identifier)])
    setStatus(st)
    setAdded(ad)
  }, [pack.identifier])

  useEffect(() => {
    if (!isNative) return
    void refresh()
    // Al volver a la app (p. ej. tras instalar WhatsApp o añadir el pack) se vuelve a comprobar
    const sub = App.addListener('resume', () => void refresh())
    return () => void sub.then((h) => h.remove())
  }, [refresh])

  const sync = async () => {
    setPhase({ kind: 'working', label: 'Preparando el pack…' })
    const files = await toPackFiles(pack, stickers)
    await syncPackToDevice(files, (done, total) => setPhase({ kind: 'working', label: 'Copiando stickers…', progress: done / total }))
    await savePack({ ...pack, syncedAt: Date.now() })
  }

  const add = async () => {
    haptic('tap')
    try {
      await sync()
      if (added) {
        // Ya estaba añadido: WhatsApp verá los cambios por image_data_version
        setPhase({ kind: 'idle' })
        haptic('success')
        toast('Pack actualizado. WhatsApp mostrará los cambios en unos segundos.', 'success')
        return
      }
      setPhase({ kind: 'working', label: 'Abriendo WhatsApp…' })
      const res = await WhatsAppStickers.addToWhatsApp({ identifier: pack.identifier })
      setPhase({ kind: 'idle' })
      if (res.added) {
        setAdded(true)
        haptic('success')
        toast(`¡"${pack.name}" ya está en WhatsApp!`, 'success')
      } else {
        toast('No se añadió el pack. Puedes intentarlo de nuevo cuando quieras.', 'info')
      }
    } catch (e) {
      console.error(e)
      haptic('error')
      if (errorCode(e) === 'NOT_INSTALLED') void refresh()
      setPhase({ kind: 'error', message: errorMessage(e) })
    }
  }

  if (!isNative) return null
  const busy = phase.kind === 'working'
  const notInstalled = status && !status.installed

  return (
    <div className="flex flex-col gap-3 rounded-4xl border border-[#25d366]/40 bg-[#25d366]/8 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">WhatsApp</h2>
        <AnimatePresence mode="wait">
          {added ? (
            <motion.span
              key="added"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 rounded-full bg-[#25d366] px-3 py-1 text-sm font-bold text-white"
            >
              Añadido <CheckCircle2 className="size-4" />
            </motion.span>
          ) : (
            status?.installed && (
              <motion.span key="no" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-full bg-surface-3 px-3 py-1 text-xs font-bold text-muted">
                Sin añadir
              </motion.span>
            )
          )}
        </AnimatePresence>
      </div>

      {notInstalled ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-lemon/25 p-3 text-sm font-semibold">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#b7791f]" />
            No encuentro WhatsApp en este teléfono. Instálalo (o WhatsApp Business) para añadir tus packs.
          </p>
          <Button size="sm" icon={ExternalLink} onClick={() => window.open(WHATSAPP_PLAY_STORE, '_system')}>
            Abrir Play Store
          </Button>
        </div>
      ) : (
        <>
          {busy && (
            <div className="flex flex-col gap-1.5" role="status">
              <span className="text-sm font-bold text-muted">{phase.label}</span>
              <ProgressBar value={phase.progress ?? 0.15} />
            </div>
          )}
          {phase.kind === 'error' && (
            <p className="flex items-start gap-2 rounded-2xl bg-danger/10 p-3 text-sm font-semibold" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" /> {phase.message}
            </p>
          )}
          <Button
            size="lg"
            className={cn('w-full !bg-none !bg-[#25d366] text-white shadow-[0_10px_24px_-10px_#25d366]', added && !outdated && '!bg-[#1fa855]')}
            icon={phase.kind === 'error' ? RefreshCw : added ? RefreshCw : Send}
            loading={busy}
            disabled={blocking || busy || !status}
            onClick={() => void add()}
          >
            {phase.kind === 'error' ? 'Reintentar' : added ? (outdated ? 'Actualizar en WhatsApp' : 'Volver a enviar') : 'Añadir a WhatsApp'}
          </Button>
          {blocking && !checking && <p className="text-xs font-bold text-danger">Corrige los errores del validador para poder añadirlo.</p>}
          {status?.consumer && status.business && !added && <p className="text-xs text-muted">Tienes WhatsApp y WhatsApp Business: te preguntará a cuál añadirlo.</p>}
        </>
      )}
    </div>
  )
}
