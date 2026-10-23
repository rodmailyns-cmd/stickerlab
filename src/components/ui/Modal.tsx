import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useBackHandler } from '@/lib/native/back'
import { cn } from './cn'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dismissable = true,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  dismissable?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Botón atrás de Android: cierra el diálogo
  useBackHandler(open, () => dismissable && onClose())
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus], button, input, textarea, select')?.focus(), 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
      prev?.focus?.()
    }
  }, [open, onClose, dismissable])

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[#2b2140]/35" onClick={dismissable ? onClose : undefined} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            className={cn(
              'relative flex max-h-[calc(92dvh-var(--sat))] w-full flex-col overflow-hidden rounded-t-4xl bg-surface shadow-soft sm:rounded-4xl',
              widths[size],
            )}
            initial={{ y: 60, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              {dismissable && (
                <button onClick={onClose} aria-label="Cerrar" className="rounded-xl p-2 hover:bg-surface-3 cursor-pointer">
                  <X className="size-5" />
                </button>
              )}
            </div>
            <div className="scroll-thin overflow-y-auto px-5 pb-5">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 pt-3 pb-[max(0.75rem,var(--sab))] sm:pb-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
