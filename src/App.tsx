import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Toasts } from '@/components/ui/Toasts'
import { LoadingCard } from '@/components/illustrations/Illustrations'
import { EditorPage } from '@/features/editor/EditorPage'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { HelpDialog } from '@/features/help/HelpDialog'
import { useTheme } from '@/components/layout/useTheme'
import { useLibrary } from '@/store/library'
import { useUi } from '@/store/ui'
import { setBackFallback } from '@/lib/native/back'
import { App as NativeApp } from '@capacitor/app'

const LibraryPage = lazy(() => import('@/features/library/LibraryPage'))
const PacksPage = lazy(() => import('@/features/packs/PacksPage'))

export default function App() {
  useTheme()
  const page = useUi((s) => s.page)
  const refresh = useLibrary((s) => s.refresh)
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Botón atrás de Android cuando no hay nada abierto: pack → lista de packs → editor → salir
  useEffect(() => {
    setBackFallback(() => {
      const ui = useUi.getState()
      if (ui.page === 'packs' && ui.openPackId) ui.setOpenPack(null)
      else if (ui.page !== 'editor') ui.setPage('editor')
      else void NativeApp.minimizeApp()
    })
  }, [])

  return (
    <div className="flex h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <TopBar />
      <main id="main" className="relative min-h-0 flex-1">
        {/* El editor se mantiene montado para no perder el lienzo al cambiar de pestaña */}
        <div className={page === 'editor' ? 'h-full' : 'hidden'}>
          <EditorPage active={page === 'editor'} />
        </div>
        <AnimatePresence mode="wait">
          {page !== 'editor' && (
            <motion.div
              key={page}
              className="absolute inset-0 overflow-y-auto scroll-thin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<LoadingCard label="Cargando…" />}>{page === 'library' ? <LibraryPage /> : <PacksPage />}</Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Onboarding />
      <HelpDialog />
      <Toasts />
    </div>
  )
}
