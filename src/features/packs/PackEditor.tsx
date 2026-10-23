import { motion, Reorder } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileArchive,
  GripVertical,
  ImageUp,
  Package,
  Plus,
  Share2,
  ShieldCheck,
  Trash2,
  Wand2,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Section, TextInput } from '@/components/ui/Controls'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/components/ui/cn'
import { EmptyState, LoadingCard } from '@/components/illustrations/Illustrations'
import { buildFullZip, buildWastickers, stickerFileName } from '@/lib/export/pack'
import { hasBlockingErrors, splitEmojis, validatePack, type Issue } from '@/lib/export/validator'
import { safeFileName, WA_LIMITS } from '@/lib/export/limits'
import { autoFixPack, canAdd, makeTrayIcon, resolveTray, toPackFiles, toValidatorPack } from '@/lib/packs/packs'
import type { PackRecord, StickerRecord } from '@/lib/storage/db'
import { canShareFiles, download, pickFile, saveFile, shareFiles } from '@/lib/download'
import { isNative } from '@/lib/native/platform'
import { WhatsAppStickers } from '@/lib/native/whatsapp'
import { useLibrary } from '@/store/library'
import { toast, useUi } from '@/store/ui'
import { useObjectUrl } from '../library/LibraryPage'
import { WhatsAppGuide } from '../help/WhatsAppGuide'
import { WhatsAppCard } from './WhatsAppCard'

function StickerRow({ pack, s, emojis, onEmojis, onRemove }: { pack: PackRecord; s: StickerRecord; emojis: string[]; onEmojis: (e: string[]) => void; onRemove: () => void }) {
  const url = useObjectUrl(s.webp)
  const [text, setText] = useState(emojis.join(''))
  useEffect(() => setText(emojis.join('')), [emojis])
  const idx = pack.items.findIndex((i) => i.stickerId === s.id)
  return (
    <Reorder.Item value={s.id} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-2 pr-3 shadow-soft" whileDrag={{ scale: 1.02 }}>
      <GripVertical className="size-5 shrink-0 cursor-grab text-muted active:cursor-grabbing" aria-label="Arrastrar para ordenar" />
      <span className="checker size-16 shrink-0 overflow-hidden rounded-2xl">{url && <img src={url} alt={s.name} className="size-full object-contain" />}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          <span className="text-muted">{stickerFileName(idx)}</span> · {s.name}
        </p>
        <label className="mt-1 flex items-center gap-2">
          <span className="text-xs font-bold text-muted">Emojis</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => onEmojis(splitEmojis(text).slice(0, 3))}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="😀🎉"
            aria-label={`Emojis de ${s.name} (hasta 3)`}
            className="w-28 rounded-xl border border-line bg-surface-2 px-2 py-1 text-lg outline-none focus:border-accent"
          />
        </label>
      </div>
      {canShareFiles([]) && (
        <IconButton
          size="sm"
          icon={Share2}
          label={`Compartir "${s.name}"`}
          onClick={() => void shareFiles([new File([s.webp], `${safeFileName(s.name)}.webp`, { type: 'image/webp' })], s.name)}
        />
      )}
      <IconButton size="sm" icon={Trash2} label="Quitar del pack" className="text-danger" onClick={onRemove} />
    </Reorder.Item>
  )
}

function IssueList({ issues }: { issues: Issue[] | null }) {
  if (!issues) return <p className="text-sm text-muted">Comprobando…</p>
  if (!issues.length)
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-ok/12 p-3 text-sm font-bold text-ok">
        <CheckCircle2 className="size-5" /> Todo cumple los requisitos de WhatsApp.
      </p>
    )
  return (
    <ul className="flex flex-col gap-1.5">
      {issues.map((i, k) => (
        <motion.li
          key={k}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn('flex items-start gap-2 rounded-2xl p-2.5 text-sm font-semibold', i.level === 'error' ? 'bg-danger/10' : 'bg-lemon/20')}
        >
          {i.level === 'error' ? <XCircle className="mt-0.5 size-4 shrink-0 text-danger" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#b7791f]" />}
          <span className="flex-1">{i.message}</span>
          {i.fixable && <span className="shrink-0 rounded-lg bg-surface px-1.5 text-[11px] font-bold text-muted">auto</span>}
        </motion.li>
      ))}
    </ul>
  )
}

function AddStickersDialog({ pack, open, onClose }: { pack: PackRecord; open: boolean; onClose: () => void }) {
  const stickers = useLibrary((s) => s.stickers)
  const savePack = useLibrary((s) => s.savePack)
  const [picked, setPicked] = useState<string[]>([])
  useEffect(() => setPicked([]), [open])
  const available = stickers.filter((s) => canAdd(pack, s) === 'ok')
  const others = stickers.filter((s) => s.animated !== pack.animated).length
  const room = WA_LIMITS.packMaxStickers - pack.items.length
  const add = async () => {
    const items = picked.slice(0, room).map((id) => {
      const s = stickers.find((x) => x.id === id)!
      return { stickerId: id, emojis: s.emojis.length ? s.emojis : ['😀'] }
    })
    await savePack({ ...pack, items: [...pack.items, ...items], updatedAt: Date.now() })
    toast(`${items.length} sticker${items.length === 1 ? '' : 's'} añadido${items.length === 1 ? '' : 's'}`, 'success')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Añadir stickers"
      size="xl"
      footer={
        <>
          <span className="mr-auto text-sm font-bold text-muted">
            {picked.length} seleccionados · caben {room}
          </span>
          <Button variant="primary" icon={Plus} disabled={!picked.length} onClick={() => void add()}>
            Añadir
          </Button>
        </>
      }
    >
      {available.length === 0 ? (
        <EmptyState
          title="No hay stickers disponibles"
          text={`Guarda stickers ${pack.animated ? 'animados' : 'estáticos'} en el editor para añadirlos aquí.${others ? ` (${others} del otro tipo no se pueden mezclar en este pack.)` : ''}`}
          mood="sleepy"
        />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {available.map((s) => (
            <PickCard key={s.id} s={s} selected={picked.includes(s.id)} onToggle={() => setPicked(picked.includes(s.id) ? picked.filter((x) => x !== s.id) : [...picked, s.id])} />
          ))}
        </div>
      )}
    </Modal>
  )
}

function PickCard({ s, selected, onToggle }: { s: StickerRecord; selected: boolean; onToggle: () => void }) {
  const url = useObjectUrl(s.webp)
  return (
    <button onClick={onToggle} aria-pressed={selected} className={cn('relative flex flex-col gap-1 rounded-3xl border-2 p-1.5 cursor-pointer', selected ? 'border-accent bg-accent-soft' : 'border-line')}>
      <span className="checker block aspect-square overflow-hidden rounded-2xl">{url && <img src={url} alt="" className="size-full object-contain" />}</span>
      <span className="truncate text-xs font-bold">{s.name}</span>
      {selected && <CheckCircle2 className="absolute right-2 top-2 size-6 rounded-full bg-white fill-accent text-white" />}
    </button>
  )
}

export function PackEditor({ pack }: { pack: PackRecord }) {
  const stickers = useLibrary((s) => s.stickers)
  const savePack = useLibrary((s) => s.savePack)
  const saveSticker = useLibrary((s) => s.saveSticker)
  const removePack = useLibrary((s) => s.removePack)
  const back = () => useUi.getState().setOpenPack(null)
  const [name, setName] = useState(pack.name)
  const [publisher, setPublisher] = useState(pack.publisher)
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [tray, setTray] = useState<Blob | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const trayUrl = useObjectUrl(tray)

  const items = useMemo(() => pack.items.map((i) => ({ item: i, s: stickers.find((x) => x.id === i.stickerId) })).filter((x): x is { item: typeof x.item; s: StickerRecord } => !!x.s), [pack.items, stickers])

  useEffect(() => {
    setName(pack.name)
    setPublisher(pack.publisher)
  }, [pack.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Validación en vivo
  useEffect(() => {
    let alive = true
    setIssues(null)
    const t = setTimeout(async () => {
      const [v, tr] = await Promise.all([toValidatorPack(pack, stickers), resolveTray(pack, stickers)])
      if (!alive) return
      setIssues(validatePack(v))
      setTray(tr)
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [pack, stickers])

  const update = (patch: Partial<PackRecord>) => void savePack({ ...pack, ...patch, updatedAt: Date.now() })

  const fix = async () => {
    if (!issues) return
    setBusy('Corrigiendo…')
    try {
      const fixed = await autoFixPack(pack, stickers, issues, saveSticker, setBusy)
      await savePack(fixed)
      setName(fixed.name)
      setPublisher(fixed.publisher)
      toast('Correcciones aplicadas', 'success')
    } catch (e) {
      console.error(e)
      toast('No se pudo corregir todo automáticamente.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const blocking = !issues || hasBlockingErrors(issues)
  const files = async () => toPackFiles(pack, stickers)
  const base = safeFileName(pack.name, 'pack')

  const exportWastickers = async () => {
    setBusy('Empaquetando…')
    try {
      await saveFile(await buildWastickers(await files()), `${base}.wastickers`)
    } finally {
      setBusy(null)
    }
  }
  const exportZip = async () => {
    setBusy('Generando ZIP…')
    try {
      await saveFile(await buildFullZip(await files()), `${base}-whatsapp.zip`)
    } finally {
      setBusy(null)
    }
  }
  const exportWebps = async () => {
    try {
      let where: string | null = null
      for (const [i, { s }] of items.entries()) {
        where = await download(s.webp, `${base}_${stickerFileName(i)}`)
        if (!isNative) await new Promise((r) => setTimeout(r, 350))
      }
      if (where) toast(`${items.length} stickers guardados en ${where}`, 'success')
    } catch (e) {
      console.error(e)
      toast('No se pudieron guardar los stickers.', 'error')
    }
  }
  const share = async () => {
    const f = await files()
    const blob = await buildWastickers(f)
    const wa = new File([blob], `${base}.wastickers`, { type: 'application/octet-stream' })
    if (await shareFiles([wa], pack.name, `Pack de stickers "${pack.name}" creado con StickerLab`)) return
    const webps = f.stickers.map((s, i) => new File([s.bytes as BlobPart], `${base}_${stickerFileName(i)}`, { type: 'image/webp' }))
    if (await shareFiles(webps, pack.name)) return
    toast('Tu navegador no permite compartir archivos. Usa las descargas.', 'info')
  }

  const uploadTray = async () => {
    const f = await pickFile('image/*')
    if (f) update({ tray: await makeTrayIcon(f), traySourceId: null })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-3 pb-10 pt-2 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <IconButton icon={ArrowLeft} label="Volver a los packs" variant="surface" onClick={back} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-semibold">{pack.name || 'Pack sin nombre'}</h1>
          <p className="text-sm text-muted">
            {pack.items.length}/30 stickers · {pack.animated ? 'animados' : 'estáticos'}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={Trash2}
          className="text-danger"
          onClick={() => {
            if (confirm(`¿Eliminar el pack "${pack.name}"? Los stickers seguirán en la biblioteca.`)) {
              back()
              void removePack(pack.id)
              if (isNative) void WhatsAppStickers.deletePack({ identifier: pack.identifier }).catch(() => {})
            }
          }}
        >
          Eliminar pack
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 rounded-4xl border border-line bg-surface p-4 shadow-soft sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-2">
              <span className="checker grid size-24 place-items-center overflow-hidden rounded-3xl border border-line">
                {trayUrl ? <img src={trayUrl} alt="Icono de bandeja" className="size-[96px]" /> : <Package className="size-8 text-muted" />}
              </span>
              <span className="text-[11px] font-bold text-muted">Icono 96×96</span>
            </div>
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput label="Nombre del pack" value={name} maxLength={128} onChange={setName} />
                <TextInput label="Autor" value={publisher} maxLength={128} onChange={setPublisher} placeholder="Tu nombre" />
              </div>
              {(name !== pack.name || publisher !== pack.publisher) && (
                <Button size="sm" variant="soft" onClick={() => update({ name: name.trim(), publisher: publisher.trim() })}>
                  Guardar nombre y autor
                </Button>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-muted">Icono:</span>
                <select
                  value={pack.tray ? 'custom' : (pack.traySourceId ?? '')}
                  onChange={(e) => e.target.value !== 'custom' && update({ tray: null, traySourceId: e.target.value || null })}
                  className="min-w-0 max-w-full flex-1 truncate rounded-xl border border-line bg-surface px-2 py-1 text-sm font-bold cursor-pointer sm:flex-none"
                  aria-label="Elegir icono del pack"
                >
                  <option value="">Automático (primer sticker)</option>
                  {pack.tray && <option value="custom">Imagen personalizada</option>}
                  {items.map(({ s }) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" icon={ImageUp} onClick={() => void uploadTray()}>
                  Subir imagen
                </Button>
              </div>
            </div>
          </div>

          <Section
            title="Stickers del pack"
            action={
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setAdding(true)} disabled={pack.items.length >= 30}>
                Añadir
              </Button>
            }
          >
            {items.length === 0 ? (
              <EmptyState title="Pack vacío" text="Añade al menos 3 stickers desde tu biblioteca." mood="wink" />
            ) : (
              <Reorder.Group
                axis="y"
                values={items.map((x) => x.s.id)}
                onReorder={(ids: string[]) => update({ items: ids.map((id) => pack.items.find((i) => i.stickerId === id)!) })}
                className="flex flex-col gap-2"
              >
                {items.map(({ item, s }) => (
                  <StickerRow
                    key={s.id}
                    pack={pack}
                    s={s}
                    emojis={item.emojis}
                    onEmojis={(e) => update({ items: pack.items.map((i) => (i.stickerId === s.id ? { ...i, emojis: e } : i)) })}
                    onRemove={() => update({ items: pack.items.filter((i) => i.stickerId !== s.id) })}
                  />
                ))}
              </Reorder.Group>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <WhatsAppCard pack={pack} stickers={stickers} blocking={blocking} checking={!issues} />
          <div className="flex flex-col gap-3 rounded-4xl border border-line bg-surface p-4 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <ShieldCheck className="size-5 text-ok" /> Validador de WhatsApp
            </h2>
            {busy ? <LoadingCard label={busy} /> : <IssueList issues={issues} />}
            {!busy && issues?.some((i) => i.fixable) && (
              <Button variant="soft" icon={Wand2} onClick={() => void fix()}>
                Corregir automáticamente
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-4xl border border-line bg-surface p-4 shadow-soft">
            <h2 className="font-display text-lg font-semibold">{isNative ? 'Guardar y compartir' : 'Exportar'}</h2>
            {blocking && issues && <p className="text-xs font-bold text-danger">Corrige los errores para exportar el pack.</p>}
            <Button variant={isNative ? 'secondary' : 'primary'} icon={Package} disabled={blocking || !!busy} onClick={() => void exportWastickers()}>
              {isNative ? 'Guardar .wastickers' : 'Exportar .wastickers'}
            </Button>
            <Button icon={FileArchive} disabled={blocking || !!busy} onClick={() => void exportZip()}>
              {isNative ? 'Guardar ZIP (copia de seguridad)' : 'ZIP completo (formato oficial)'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button icon={Download} size="sm" disabled={!items.length} onClick={() => void exportWebps()}>
                {isNative ? 'A la galería' : '.webp sueltos'}
              </Button>
              <Button icon={Share2} size="sm" disabled={blocking || !!busy} onClick={() => void share()}>
                Compartir
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-4xl border border-line bg-surface p-4 shadow-soft">
            <h2 className="font-display text-lg font-semibold">Cómo añadirlo a WhatsApp</h2>
            <WhatsAppGuide />
          </div>
        </div>
      </div>
      <AddStickersDialog pack={pack} open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
