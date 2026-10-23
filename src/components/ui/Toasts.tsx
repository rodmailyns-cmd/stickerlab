import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useUi } from '@/store/ui'

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(4.5rem+var(--sat))] z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info
          return (
            <motion.button
              key={t.id}
              layout
              initial={{ y: -30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.9 }}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-left text-sm font-bold shadow-soft cursor-pointer"
            >
              <Icon className={t.kind === 'success' ? 'size-5 text-ok' : t.kind === 'error' ? 'size-5 text-danger' : 'size-5 text-accent-2'} />
              {t.text}
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
