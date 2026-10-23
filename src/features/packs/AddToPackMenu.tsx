import { AnimatePresence, motion } from 'framer-motion'
import { Package, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { StickerRecord } from '@/lib/storage/db'
import { ADD_MESSAGES, canAdd, newPack } from '@/lib/packs/packs'
import { useLibrary } from '@/store/library'
import { haptic } from '@/lib/native/haptics'
import { toast } from '@/store/ui'

/** Menú emergente para añadir un sticker a un pack existente o a uno nuevo. */
export function AddToPackMenu({ sticker, children }: { sticker: StickerRecord; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const packs = useLibrary((s) => s.packs)
  const savePack = useLibrary((s) => s.savePack)

  useEffect(() => {
    if (!open) return
    const h = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', h)
    return () => window.removeEventListener('pointerdown', h)
  }, [open])

  const add = async (packId: string | null) => {
    let pack = packs.find((p) => p.id === packId)
    if (!pack) pack = newPack(sticker.animated ? 'Mis animados' : 'Mis stickers', sticker.animated)
    const r = canAdd(pack, sticker)
    if (r !== 'ok') {
      haptic('error')
      toast(ADD_MESSAGES[r], 'error')
      return
    }
    await savePack({ ...pack, items: [...pack.items, { stickerId: sticker.id, emojis: sticker.emojis.length ? sticker.emojis : ['😀'] }], updatedAt: Date.now() })
    haptic('success')
    toast(`Añadido a "${pack.name}"`, 'success')
    setOpen(false)
  }

  const compatible = packs.filter((p) => p.animated === sticker.animated)
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)}>{children}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            className="absolute bottom-full right-0 z-20 mb-2 w-64 rounded-3xl border-2 border-line bg-surface p-2 shadow-soft"
            role="menu"
          >
            <p className="px-2 pb-1 text-xs font-bold text-muted">Packs {sticker.animated ? 'animados' : 'estáticos'}</p>
            <div className="scroll-thin max-h-56 overflow-y-auto">
              {compatible.map((p) => (
                <button key={p.id} role="menuitem" onClick={() => void add(p.id)} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-bold hover:bg-surface-3 cursor-pointer">
                  <Package className="size-4 text-accent-2" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted">{p.items.length}/30</span>
                </button>
              ))}
            </div>
            <button role="menuitem" onClick={() => void add(null)} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-bold text-accent-text hover:bg-accent-soft cursor-pointer">
              <Plus className="size-4" /> Nuevo pack
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
