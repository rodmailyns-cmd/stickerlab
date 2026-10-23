import { motion } from 'framer-motion'
import { Download, HelpCircle, Images, Monitor, Moon, Package, Palette, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useUi, type Page } from '@/store/ui'
import { useLibrary } from '@/store/library'
import { IconButton } from '../ui/Button'
import { cn } from '../ui/cn'

const NAV: { id: Page; label: string; icon: typeof Palette }[] = [
  { id: 'editor', label: 'Editor', icon: Palette },
  { id: 'library', label: 'Biblioteca', icon: Images },
  { id: 'packs', label: 'Packs', icon: Package },
]

interface InstallEvent extends Event {
  prompt: () => Promise<void>
}

export function TopBar() {
  const { page, setPage, theme, setTheme, setHelpOpen } = useUi()
  const count = useLibrary((s) => s.stickers.length)
  const [install, setInstall] = useState<InstallEvent | null>(null)
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault()
      setInstall(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const themeLabel = theme === 'light' ? 'Tema claro' : theme === 'dark' ? 'Tema oscuro' : 'Tema del sistema'

  return (
    <header className="z-30 flex h-[calc(3.25rem+var(--sat))] lg:h-[calc(4rem+var(--sat))] shrink-0 items-center gap-1.5 pt-[var(--sat)] pr-[max(0.5rem,var(--sar))] pl-[max(0.5rem,var(--sal))] sm:gap-2 sm:pr-[max(1.25rem,var(--sar))] sm:pl-[max(1.25rem,var(--sal))]">
      <button onClick={() => setPage('editor')} className="flex items-center gap-2 rounded-2xl pr-2 cursor-pointer" aria-label="StickerLab, ir al editor">
        <img src="/favicon.svg" alt="" className="size-8" />
        <span className="hidden font-display text-2xl font-bold tracking-tight sm:inline">
          Sticker<span className="text-gradient">Lab</span>
        </span>
      </button>
      <nav aria-label="Secciones" className="mx-auto flex min-w-0 items-center gap-0.5 rounded-full bg-surface-3/70 p-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            aria-label={label}
            title={label}
            aria-current={page === id ? 'page' : undefined}
            className={cn('relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold cursor-pointer transition-colors', page === id ? 'text-white' : 'text-muted hover:text-ink')}
          >
            {page === id && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 450, damping: 35 }} />}
            <Icon className="relative size-4" strokeWidth={2.5} />
            <span className={cn('relative', page !== id && 'hidden sm:inline')}>{label}</span>
            {id === 'library' && count > 0 && <span className="relative hidden rounded-full bg-white/25 px-1.5 text-[11px] sm:inline">{count}</span>}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-1">
        {install && <IconButton icon={Download} label="Instalar la app" onClick={() => void install.prompt().then(() => setInstall(null))} />}
        <IconButton icon={ThemeIcon} label={`${themeLabel} (cambiar)`} onClick={() => setTheme(nextTheme)} />
        <IconButton icon={HelpCircle} label="Ayuda y atajos (?)" onClick={() => setHelpOpen(true)} />
      </div>
    </header>
  )
}
