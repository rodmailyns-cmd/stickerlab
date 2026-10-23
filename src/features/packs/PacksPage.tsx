import { motion } from 'framer-motion'
import { FileUp, Package, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { pickFile } from '@/lib/download'
import { haptic } from '@/lib/native/haptics'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/illustrations/Illustrations'
import { newPack } from '@/lib/packs/packs'
import type { PackRecord } from '@/lib/storage/db'
import { useLibrary } from '@/store/library'
import { toast, useUi } from '@/store/ui'
import { useObjectUrl } from '../library/LibraryPage'
import { PackEditor } from './PackEditor'

function PackCard({ p }: { p: PackRecord }) {
  const stickers = useLibrary((s) => s.stickers)
  const first = stickers.filter((s) => p.items.some((i) => i.stickerId === s.id)).slice(0, 4)
  const open = useUi((s) => s.setOpenPack)
  return (
    <motion.button
      layout
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => open(p.id)}
      className="flex flex-col gap-3 rounded-4xl border border-line bg-surface p-4 text-left shadow-soft cursor-pointer"
    >
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 4 }, (_, i) => (
          <Thumb key={i} blob={first[i]?.webp} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold">{p.name}</h3>
          <p className="truncate text-xs text-muted">{p.publisher || 'Sin autor'}</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold">
          {p.items.length}/30 · {p.animated ? 'animado' : 'estático'}
        </span>
      </div>
    </motion.button>
  )
}

function Thumb({ blob }: { blob?: Blob }) {
  const url = useObjectUrl(blob ?? null)
  return <span className="checker block aspect-square overflow-hidden rounded-xl">{url && <img src={url} alt="" className="size-full object-contain" />}</span>
}

export default function PacksPage() {
  const packs = useLibrary((s) => s.packs)
  const loaded = useLibrary((s) => s.loaded)
  const savePack = useLibrary((s) => s.savePack)
  const openId = useUi((s) => s.openPackId)
  const setOpen = useUi((s) => s.setOpenPack)
  const [importing, setImporting] = useState(false)
  const openPack = packs.find((p) => p.id === openId)

  if (openPack) return <PackEditor pack={openPack} />

  const importArchive = async () => {
    const f = await pickFile('.wastickers,.zip,application/zip,application/octet-stream')
    if (!f) return
    setImporting(true)
    try {
      const { importPackArchive } = await import('@/lib/storage/packImport')
      const { pack, stickers } = await importPackArchive(f, f.name)
      const lib = useLibrary.getState()
      for (const s of stickers) await lib.saveSticker(s)
      await savePack(pack)
      haptic('success')
      toast(`Pack "${pack.name}" importado con ${pack.items.length} stickers`, 'success')
      setOpen(pack.id)
    } catch (e) {
      console.error(e)
      toast(`No se pudo importar: ${(e as Error).message}`, 'error')
    } finally {
      setImporting(false)
    }
  }

  const create = async (animated: boolean) => {
    const p = newPack(animated ? 'Mi pack animado' : 'Mi pack', animated)
    await savePack(p)
    setOpen(p.id)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-3 pb-10 pt-2 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Packs para WhatsApp</h1>
          <p className="text-sm text-muted">De 3 a 30 stickers por pack. Animados y estáticos van en packs separados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" icon={FileUp} loading={importing} onClick={() => void importArchive()}>
            Importar pack
          </Button>
          <Button size="sm" icon={Package} onClick={() => void create(false)}>
            Pack estático
          </Button>
          <Button size="sm" variant="primary" icon={Sparkles} onClick={() => void create(true)}>
            Pack animado
          </Button>
        </div>
      </div>
      {loaded && packs.length === 0 ? (
        <EmptyState
          title="Todavía no tienes packs"
          text="Un pack agrupa tus stickers para añadirlos a WhatsApp de una vez. Crea uno y añade al menos 3 stickers."
          mood="happy"
          action={
            <Button variant="primary" icon={Plus} onClick={() => void create(false)}>
              Crear pack
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((p) => (
            <PackCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}
