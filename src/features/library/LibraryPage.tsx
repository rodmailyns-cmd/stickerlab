import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Download, DownloadCloud, Heart, PackagePlus, Pencil, Plus, Search, Tag, Trash2, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Controls'
import { cn } from '@/components/ui/cn'
import { EmptyState } from '@/components/illustrations/Illustrations'
import { cloneDoc, uid } from '@/lib/doc/factory'
import { formatBytes, safeFileName } from '@/lib/export/limits'
import type { StickerRecord } from '@/lib/storage/db'
import { exportBackup, importBackup } from '@/lib/storage/project'
import { saveFile, pickFile } from '@/lib/download'
import { useEditor } from '@/store/editor'
import { useLibrary } from '@/store/library'
import { toast, useUi } from '@/store/ui'
import { AddToPackMenu } from '../packs/AddToPackMenu'

type Filter = 'todos' | 'favoritos' | 'estaticos' | 'animados'

export function useObjectUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return setUrl(null)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function openInEditor(s: StickerRecord) {
  const st = useEditor.getState()
  if (st.dirty && st.stickerId !== s.id && !confirm('Tienes cambios sin guardar en el editor. ¿Abrir este sticker igualmente?')) return
  st.loadDoc(structuredClone(s.doc), s.id)
  useUi.getState().setPage('editor')
}

function StickerCard({ s }: { s: StickerRecord }) {
  const url = useObjectUrl(s.webp)
  const { saveSticker, removeSticker } = useLibrary.getState()

  const duplicate = async () => {
    const now = Date.now()
    await saveSticker({ ...s, id: uid(), name: `${s.name} (copia)`, doc: cloneDoc(s.doc, `${s.name} (copia)`), favorite: false, createdAt: now, updatedAt: now })
    toast('Sticker duplicado', 'success')
  }
  const editTags = async () => {
    const v = prompt('Etiquetas separadas por comas', s.tags.join(', '))
    if (v === null) return
    await saveSticker({ ...s, tags: v.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean), updatedAt: Date.now() })
  }
  const remove = async () => {
    if (confirm(`¿Eliminar "${s.name}"? También se quitará de sus packs.`)) {
      await removeSticker(s.id)
      toast('Sticker eliminado', 'info')
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col rounded-4xl border border-line bg-surface p-2.5 shadow-soft"
    >
      <button onClick={() => openInEditor(s)} className="checker relative aspect-square overflow-hidden rounded-3xl cursor-pointer" aria-label={`Editar ${s.name}`}>
        {url && <img src={url} alt={s.name} loading="lazy" className="size-full object-contain transition-transform duration-300 group-hover:scale-105" />}
        <span className="absolute left-2 top-2 rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold">{s.animated ? '▶ Animado' : 'Estático'}</span>
      </button>
      <button
        onClick={() => void saveSticker({ ...s, favorite: !s.favorite, updatedAt: s.updatedAt })}
        aria-label={s.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
        aria-pressed={s.favorite}
        className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-surface shadow backdrop-blur cursor-pointer"
      >
        <motion.span whileTap={{ scale: 1.5 }}>
          <Heart className={cn('size-5', s.favorite ? 'fill-accent text-accent' : 'text-muted')} />
        </motion.span>
      </button>
      <div className="flex items-start justify-between gap-2 px-1.5 pt-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{s.name}</h3>
          <p className="text-xs text-muted">
            {formatBytes(s.bytes)} · {s.emojis.join('') || 'sin emojis'}
          </p>
        </div>
      </div>
      {s.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1.5 pt-1">
          {s.tags.map((t) => (
            <span key={t} className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-muted">
              #{t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-0.5 border-t border-line pt-2">
        <IconButton size="sm" icon={Pencil} label="Editar" onClick={() => openInEditor(s)} />
        <IconButton size="sm" icon={Copy} label="Duplicar" onClick={() => void duplicate()} />
        <IconButton size="sm" icon={Tag} label="Etiquetas" onClick={() => void editTags()} />
        <IconButton size="sm" icon={Download} label="Descargar .webp" onClick={() => void saveFile(s.webp, `${safeFileName(s.name)}.webp`)} />
        <AddToPackMenu sticker={s}>
          <IconButton size="sm" icon={PackagePlus} label="Añadir a un pack" />
        </AddToPackMenu>
        <IconButton size="sm" icon={Trash2} label="Eliminar" className="text-danger" onClick={() => void remove()} />
      </div>
    </motion.article>
  )
}

export default function LibraryPage() {
  const stickers = useLibrary((s) => s.stickers)
  const loaded = useLibrary((s) => s.loaded)
  const refresh = useLibrary((s) => s.refresh)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('todos')
  const [tag, setTag] = useState<string | null>(null)

  const tags = useMemo(() => [...new Set(stickers.flatMap((s) => s.tags))].sort(), [stickers])
  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    return stickers.filter((s) => {
      if (filter === 'favoritos' && !s.favorite) return false
      if (filter === 'estaticos' && s.animated) return false
      if (filter === 'animados' && !s.animated) return false
      if (tag && !s.tags.includes(tag)) return false
      if (!query) return true
      return s.name.toLowerCase().includes(query) || s.tags.some((t) => t.includes(query)) || s.emojis.join('').includes(query)
    })
  }, [stickers, q, filter, tag])

  const newSticker = () => {
    useEditor.getState().resetDoc()
    useUi.getState().setPage('editor')
  }

  const doBackup = async () => {
    await saveFile(await exportBackup(), `stickerlab-copia-${new Date().toISOString().slice(0, 10)}.zip`)
    toast('Copia de seguridad descargada', 'success')
  }
  const doRestore = async () => {
    const f = await pickFile('.zip,application/zip')
    if (!f) return
    try {
      const r = await importBackup(f)
      await refresh()
      toast(`Restaurados ${r.stickers} stickers y ${r.packs} packs`, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 pb-10 pt-2 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Biblioteca</h1>
          <p className="text-sm text-muted">{stickers.length} stickers guardados en este dispositivo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={DownloadCloud} onClick={() => void doBackup()} disabled={!stickers.length}>
            Copia de seguridad
          </Button>
          <Button size="sm" icon={UploadCloud} onClick={() => void doRestore()}>
            Restaurar copia
          </Button>
          <Button size="sm" variant="primary" icon={Plus} onClick={newSticker}>
            Nuevo sticker
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-4xl border border-line bg-surface/80 p-3 shadow-soft backdrop-blur sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-2xl bg-surface-2 px-3">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, etiqueta o emoji…" aria-label="Buscar stickers" className="h-10 w-full bg-transparent text-sm font-semibold outline-none" />
        </label>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {(
            [
              ['todos', 'Todos'],
              ['favoritos', '♥ Favoritos'],
              ['estaticos', 'Estáticos'],
              ['animados', 'Animados'],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="no-scrollbar -mt-2 flex gap-1.5 overflow-x-auto">
          {tags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              #{t}
            </Chip>
          ))}
        </div>
      )}

      {!loaded ? null : stickers.length === 0 ? (
        <EmptyState
          title="Tu biblioteca está vacía"
          text="Crea tu primer sticker en el editor y pulsa Guardar. Aparecerá aquí, listo para añadirlo a un pack."
          mood="sleepy"
          action={
            <Button variant="primary" icon={Plus} onClick={newSticker}>
              Crear mi primer sticker
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState title="Sin resultados" text="Ningún sticker coincide con la búsqueda o el filtro." mood="wow" />
      ) : (
        <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <AnimatePresence>
            {list.map((s) => (
              <StickerCard key={s.id} s={s} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
