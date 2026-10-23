import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import {
  Brush,
  ChevronDown,
  Clapperboard,
  FilePlus2,
  FolderOpen,
  ImagePlus,
  Layers,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pause,
  Play,
  Redo2,
  Save,
  Scissors,
  Shapes,
  SlidersHorizontal,
  Type,
  Undo2,
  UploadCloud,
  Download,
} from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { newTextLayer } from '@/lib/doc/factory'
import { getMeta, setMeta } from '@/lib/storage/db'
import { exportProject, importProject } from '@/lib/storage/project'
import { saveFile, pickFile } from '@/lib/download'
import { safeFileName } from '@/lib/export/limits'
import type { StickerDoc } from '@/types/doc'
import { useEditor, type PanelId } from '@/store/editor'
import { toast, useUi } from '@/store/ui'
import { CanvasStage } from './CanvasStage'
import { Timeline } from './Timeline'
import { WeightMeter } from './WeightMeter'
import { SaveDialog } from './SaveDialog'
import { VideoImportDialog } from './VideoImportDialog'
import { CameraDialog } from './CameraDialog'
import { useImport } from './useImport'
import { useMedia } from '@/components/layout/useMedia'
import { useBackHandler } from '@/lib/native/back'
import { haptic } from '@/lib/native/haptics'
import { ImportPanel } from './panels/ImportPanel'
import { TemplatesPanel } from './panels/TemplatesPanel'
import { TextPanel } from './panels/TextPanel'
import { ElementsPanel } from './panels/ElementsPanel'
import { DrawPanel } from './panels/DrawPanel'
import { CutoutPanel } from './panels/CutoutPanel'
import { FiltersPanel } from './panels/FiltersPanel'
import { AnimatePanel } from './panels/AnimatePanel'
import { LayersPanel } from './panels/LayersPanel'

const TOOLS: { id: PanelId; label: string; icon: ComponentType<{ className?: string }>; mobileOnly?: boolean }[] = [
  { id: 'import', label: 'Importar', icon: ImagePlus },
  { id: 'templates', label: 'Plantillas', icon: LayoutTemplate },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'elements', label: 'Elementos', icon: Shapes },
  { id: 'draw', label: 'Dibujo', icon: Brush },
  { id: 'cutout', label: 'Recorte', icon: Scissors },
  { id: 'filters', label: 'Filtros', icon: SlidersHorizontal },
  { id: 'animate', label: 'Animar', icon: Clapperboard },
  { id: 'layers', label: 'Capas', icon: Layers, mobileOnly: true },
]

const PANELS: Record<PanelId, ComponentType> = {
  import: ImportPanel,
  templates: TemplatesPanel,
  text: TextPanel,
  elements: ElementsPanel,
  draw: DrawPanel,
  cutout: CutoutPanel,
  filters: FiltersPanel,
  animate: AnimatePanel,
  layers: LayersPanel,
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

function useShortcuts(active: boolean, openSave: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || document.querySelector('[role="dialog"]')) return
      const st = useEditor.getState()
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      const handled = () => e.preventDefault()
      if (mod && k === 'z' && !e.shiftKey) return handled(), st.undo()
      if ((mod && k === 'z' && e.shiftKey) || (mod && k === 'y')) return handled(), st.redo()
      if (mod && k === 's') return handled(), openSave()
      if (mod && k === 'd') return handled(), st.duplicateLayers(st.selection)
      if (mod && k === 'g' && e.shiftKey) return handled(), st.ungroupSelection()
      if (mod && k === 'g') return handled(), st.groupSelection()
      if (mod && k === 'a') return handled(), st.select(st.doc.layers.map((l) => l.id))
      if (mod) return
      if (k === 'delete' || k === 'backspace') return handled(), st.removeLayers(st.selection)
      if (k === 'escape') return st.select([]), st.setTool('select')
      if (k === ' ') {
        handled()
        if (!st.doc.animated) st.setDoc((d) => void (d.animated = true))
        return st.setPlaying(!st.playing)
      }
      const step = e.shiftKey ? 10 : 1
      if (k === 'arrowleft') return handled(), st.nudgeSelection(-step, 0)
      if (k === 'arrowright') return handled(), st.nudgeSelection(step, 0)
      if (k === 'arrowup') return handled(), st.nudgeSelection(0, -step)
      if (k === 'arrowdown') return handled(), st.nudgeSelection(0, step)
      if (k === 'v') return st.setTool('select')
      if (k === 'b') return st.setTool('brush'), st.setPanel('draw')
      if (k === 'e') return st.setTool('eraser'), st.setPanel('draw')
      if (k === 't') return st.addLayer(newTextLayer('¡Hola!')), st.setPanel('text')
      if (k === ']') return st.selection.forEach((id) => st.shiftLayer(id, 1))
      if (k === '[') return st.selection.forEach((id) => st.shiftLayer(id, -1))
      if (e.key === '?') return useUi.getState().setHelpOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, openSave])
}

/** Guarda un borrador automáticamente para no perder el trabajo. */
function useDraft() {
  const doc = useEditor((s) => s.doc)
  const stickerId = useEditor((s) => s.stickerId)
  const loaded = useRef(false)
  useEffect(() => {
    void getMeta<{ doc: StickerDoc; stickerId: string | null }>('draft').then((d) => {
      if (d?.doc?.layers?.length && !useEditor.getState().doc.layers.length) useEditor.getState().loadDoc(d.doc, d.stickerId)
      loaded.current = true
    })
  }, [])
  useEffect(() => {
    if (!loaded.current) return
    const t = setTimeout(() => void setMeta('draft', { doc, stickerId }), 800)
    return () => clearTimeout(t)
  }, [doc, stickerId])
}

function ProjectMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useBackHandler(open, () => setOpen(false))
  useEffect(() => {
    if (!open) return
    const h = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', h)
    return () => window.removeEventListener('pointerdown', h)
  }, [open])
  const st = useEditor.getState()
  const items = [
    {
      icon: FilePlus2,
      label: 'Nuevo sticker',
      run: () => {
        if (!st.dirty || confirm('¿Empezar un sticker nuevo? Los cambios sin guardar se perderán.')) useEditor.getState().resetDoc()
      },
    },
    {
      icon: FolderOpen,
      label: 'Abrir proyecto (.stickerlab)',
      run: async () => {
        const f = await pickFile('.stickerlab,application/zip')
        if (!f) return
        try {
          useEditor.getState().loadDoc(await importProject(f), null)
          toast('Proyecto abierto', 'success')
        } catch (e) {
          toast((e as Error).message, 'error')
        }
      },
    },
    {
      icon: Download,
      label: 'Guardar proyecto editable',
      run: async () => {
        const d = useEditor.getState().doc
        await saveFile(await exportProject(d), `${safeFileName(d.name, 'proyecto')}.stickerlab`)
      },
    },
  ]
  return (
    <div ref={ref} className="relative">
      <IconButton icon={MoreHorizontal} label="Más opciones del proyecto" onClick={() => setOpen(!open)} active={open} />
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="absolute left-0 top-full z-30 mt-2 w-64 rounded-3xl border-2 border-line bg-surface p-2 shadow-soft"
          >
            {items.map(({ icon: Icon, label, run }) => (
              <button
                key={label}
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  void run()
                }}
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-bold hover:bg-surface-3 cursor-pointer"
              >
                <Icon className="size-4 text-accent-2" /> {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Toolbar({ onSave }: { onSave: () => void }) {
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const animated = useEditor((s) => s.doc.animated)
  const playing = useEditor((s) => s.playing)
  const name = useEditor((s) => s.doc.name)
  const { undo, redo, setPlaying, setDoc } = useEditor.getState()
  return (
    <div className="relative z-20 flex items-center gap-1.5 rounded-3xl border-2 border-line bg-surface/90 p-1.5 shadow-soft backdrop-blur">
      <ProjectMenu />
      <input
        aria-label="Nombre del sticker"
        value={name}
        onChange={(e) => setDoc((d) => void (d.name = e.target.value), { coalesce: 'name' })}
        className="hidden w-32 min-w-0 rounded-xl bg-transparent px-2 py-1 text-sm font-extrabold outline-none hover:bg-surface-3 focus:bg-surface-3 md:block lg:w-40"
      />
      <span className="mx-0.5 hidden h-6 w-0.5 rounded bg-line md:block" />
      <IconButton icon={Undo2} label="Deshacer (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
      <IconButton icon={Redo2} label="Rehacer (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
      {animated && <IconButton icon={playing ? Pause : Play} label={playing ? 'Pausar' : 'Reproducir'} onClick={() => setPlaying(!playing)} active={playing} />}
      <div className="ml-auto flex min-w-0 items-center gap-1.5">
        <WeightMeter />
        <Button variant="primary" size="sm" icon={Save} onClick={onSave} className="h-10 px-4" aria-label="Guardar sticker (Ctrl+S)">
          <span className="hidden sm:inline">Guardar</span>
        </Button>
      </div>
    </div>
  )
}

export function EditorPage({ active }: { active: boolean }) {
  const panel = useEditor((s) => s.panel)
  const setPanel = useEditor((s) => s.setPanel)
  const animated = useEditor((s) => s.doc.animated)
  const importFiles = useImport((s) => s.importFiles)
  const [saveOpen, setSaveOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(true)
  const [sheetTall, setSheetTall] = useState(false)
  const dragControls = useDragControls()
  const openSave = useRef(() => setSaveOpen(true)).current
  useShortcuts(active && !saveOpen, openSave)
  useDraft()

  // Pegar imágenes desde el portapapeles
  useEffect(() => {
    if (!active) return
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
      if (files.length) {
        e.preventDefault()
        void importFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [active, importFiles])

  const desktop = useMedia('(min-width: 1024px)')
  const wide = useMedia('(min-width: 1280px)')
  // En escritorio las capas tienen su propia columna (xl) o su pestaña
  const effective = desktop && wide && panel === 'layers' ? 'import' : panel
  const Panel = PANELS[effective]
  const current = TOOLS.find((t) => t.id === effective)!
  // Botón atrás de Android: primero cierra la hoja inferior
  useBackHandler(active && !desktop && sheetOpen, () => setSheetOpen(false))

  return (
    <div
      className="relative flex h-full min-h-0 flex-col lg:flex-row"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files)
      }}
    >
      {/* Barra de herramientas lateral (escritorio) */}
      {desktop && (
      <nav aria-label="Herramientas" className="flex w-[84px] shrink-0 flex-col items-center gap-1 overflow-y-auto py-2 pl-3 no-scrollbar">
        {TOOLS.filter((t) => !t.mobileOnly || !wide).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPanel(id)}
            aria-current={effective === id}
            className={cn(
              'relative flex w-full flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-extrabold transition-colors cursor-pointer',
              effective === id ? 'text-accent-text' : 'text-muted hover:bg-surface/70 hover:text-ink',
            )}
          >
            {effective === id && <motion.span layoutId="rail-pill" className="absolute inset-0 rounded-2xl bg-surface shadow-soft" transition={{ type: 'spring', stiffness: 450, damping: 35 }} />}
            <Icon className="relative size-5" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </nav>
      )}

      {/* Panel lateral (escritorio) */}
      {desktop && (
      <aside aria-label={current.label} className="flex w-[330px] shrink-0 flex-col p-3 pl-2">
        <div className="flex min-h-0 flex-1 flex-col rounded-4xl border-2 border-line bg-surface/90 shadow-soft backdrop-blur">
          <h2 className="px-5 pt-4 pb-2 font-display text-xl font-semibold">{current.label}</h2>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <AnimatePresence mode="wait">
              <motion.div key={effective} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
                <Panel />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </aside>
      )}

      {/* Centro: barra, lienzo y línea de tiempo */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2 sm:p-3 lg:pl-1">
        <Toolbar onSave={() => setSaveOpen(true)} />
        <CanvasStage className="flex-1 py-1" />
        {animated && (
          <div className="hidden sm:block">
            <Timeline />
          </div>
        )}
        {animated && (
          <div className="sm:hidden">
            <Timeline compact />
          </div>
        )}
      </section>

      {/* Capas (escritorio) */}
      {wide && (
      <aside aria-label="Capas" className="flex w-[300px] shrink-0 flex-col p-3 pl-0">
        <div className="flex min-h-0 flex-1 flex-col rounded-4xl border-2 border-line bg-surface/90 shadow-soft backdrop-blur">
          <h2 className="flex items-center gap-2 px-5 pt-4 pb-2 font-display text-xl font-semibold">
            <Layers className="size-5 text-accent-2" /> Capas
          </h2>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <LayersPanel />
          </div>
        </div>
      </aside>
      )}

      {/* Móvil y tablet: hoja inferior + barra de herramientas */}
      {!desktop && (
      <div className="flex flex-col">
        <AnimatePresence initial={false}>
          {sheetOpen && (
            <motion.div
              key="sheet"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Hoja deslizable: arrastra el asa hacia arriba para ampliarla y hacia abajo para cerrarla */}
              <motion.div
                drag="y"
                dragListener={false}
                dragControls={dragControls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.15, bottom: 0.6 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 60 || info.velocity.y > 500) {
                    if (sheetTall) setSheetTall(false)
                    else setSheetOpen(false)
                    haptic('select')
                  } else if (info.offset.y < -40 || info.velocity.y < -500) {
                    setSheetTall(true)
                    haptic('select')
                  }
                }}
                className="mx-2 rounded-t-4xl border-2 border-b-0 border-line bg-surface shadow-soft"
              >
                <div
                  onPointerDown={(e) => dragControls.start(e)}
                  className="flex touch-none flex-col items-center px-5 pt-2 pb-1"
                >
                  <span className="h-1.5 w-10 rounded-full bg-line" aria-hidden />
                  <div className="flex w-full items-center justify-between pt-1">
                    <span className="font-display text-lg font-semibold">{current.label}</span>
                    <div className="flex items-center">
                      <IconButton size="sm" icon={sheetTall ? Minimize2 : Maximize2} label={sheetTall ? 'Reducir panel' : 'Ampliar panel'} onClick={() => setSheetTall(!sheetTall)} />
                      <IconButton size="sm" icon={ChevronDown} label="Contraer panel" onClick={() => setSheetOpen(false)} />
                    </div>
                  </div>
                </div>
                <motion.div
                  animate={{ maxHeight: sheetTall ? '62dvh' : '38dvh' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                  className="scroll-thin overflow-y-auto overscroll-contain px-5 pb-4"
                >
                  <Panel />
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <nav aria-label="Herramientas" className="hide-on-keyboard no-scrollbar flex gap-1 overflow-x-auto border-t-2 border-line bg-surface/95 px-[max(0.5rem,var(--sal))] pt-1.5 pb-[max(0.4rem,var(--sab))] backdrop-blur">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                haptic('select')
                if (panel === id) setSheetOpen(!sheetOpen)
                else {
                  setPanel(id)
                  setSheetOpen(true)
                }
              }}
              aria-current={panel === id}
              className={cn('flex min-w-16 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-extrabold cursor-pointer', panel === id ? 'bg-accent-soft text-accent-text' : 'text-muted')}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>
      )}

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-4xl border-4 border-dashed border-accent bg-accent-soft/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-2 text-accent-text">
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                <UploadCloud className="size-14" />
              </motion.div>
              <p className="font-display text-2xl font-semibold">Suelta para añadir</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SaveDialog open={saveOpen} onClose={() => setSaveOpen(false)} />
      <VideoImportDialog />
      <CameraDialog />
    </div>
  )
}
