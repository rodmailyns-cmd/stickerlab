import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { StepArt } from '@/components/illustrations/Illustrations'
import { useUi } from '@/store/ui'

const STEPS = [
  { title: 'Importa o empieza de cero', text: 'Arrastra una foto, pega una imagen, usa la cámara o convierte un GIF o vídeo corto. Quita el fondo con un clic.' },
  { title: 'Decora y dale vida', text: 'Añade textos tipo meme, emojis, marcos, dibujos y filtros. Anima cualquier capa con rebote, latido, giro y más.' },
  { title: 'Llévalo a WhatsApp', text: 'Crea packs de 3 a 30 stickers. StickerLab comprueba los límites de WhatsApp y los optimiza solo. Todo se queda en tu dispositivo.' },
] as const

export function Onboarding() {
  const onboarded = useUi((s) => s.onboarded)
  const finish = useUi((s) => s.finishOnboarding)
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1

  return (
    <AnimatePresence>
      {!onboarded && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#2b2140]/45 backdrop-blur-sm" aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Bienvenida a StickerLab"
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="relative w-full max-w-md overflow-hidden rounded-4xl border-2 border-line bg-surface p-6 text-center shadow-soft"
          >
            <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-extrabold text-accent-text">
              <Sparkles className="size-3.5" /> Bienvenida a StickerLab · {step + 1}/3
            </p>
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-col items-center gap-3">
                <div className="flex h-44 items-center justify-center">
                  <StepArt step={step as 0 | 1 | 2} />
                </div>
                <h2 className="font-display text-2xl font-semibold">{STEPS[step].title}</h2>
                <p className="text-[15px] text-muted">{STEPS[step].text}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-5 flex items-center justify-center gap-2" aria-hidden>
              {STEPS.map((_, i) => (
                <span key={i} className={cn('h-2.5 rounded-full transition-all', i === step ? 'w-7 bg-gradient-to-r from-accent to-accent-2' : 'w-2.5 bg-surface-3')} />
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={finish}>
                Saltar
              </Button>
              <Button variant="primary" iconRight={last ? undefined : ArrowRight} onClick={() => (last ? finish() : setStep(step + 1))} data-autofocus>
                {last ? '¡A crear!' : 'Siguiente'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
