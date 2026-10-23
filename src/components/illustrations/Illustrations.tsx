import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

/** Mascota de StickerLab: un sticker con carita, con varias expresiones. */
export function Mascot({ mood = 'happy', size = 140, className }: { mood?: 'happy' | 'sleepy' | 'wow' | 'wink'; size?: number; className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      className={className}
      aria-hidden
      animate={{ y: [0, -6, 0], rotate: [-2, 2, -2] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <defs>
        <linearGradient id="m-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb3d9" />
          <stop offset="1" stopColor="#c4b0ff" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="148" rx="44" ry="7" fill="currentColor" opacity=".08" />
      <path d="M40 22h62l30 30v58a18 18 0 0 1-18 18H46a18 18 0 0 1-18-18V34a12 12 0 0 1 12-12z" fill="#fff" stroke="url(#m-g)" strokeWidth="8" strokeLinejoin="round" />
      <path d="M102 22v18a12 12 0 0 0 12 12h18" fill="#ffe1f0" stroke="url(#m-g)" strokeWidth="8" strokeLinejoin="round" />
      {mood === 'sleepy' ? (
        <>
          <path d="M56 78q8 6 16 0M90 78q8 6 16 0" stroke="#2b2140" strokeWidth="5" fill="none" strokeLinecap="round" />
          <text x="112" y="44" fontSize="18" fontWeight="900" fill="#a78bfa">z</text>
          <text x="124" y="30" fontSize="13" fontWeight="900" fill="#a78bfa">z</text>
        </>
      ) : mood === 'wink' ? (
        <>
          <circle cx="64" cy="76" r="7" fill="#2b2140" />
          <path d="M90 76q8 -6 16 0" stroke="#2b2140" strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="64" cy="76" r={mood === 'wow' ? 8 : 7} fill="#2b2140" />
          <circle cx="98" cy="76" r={mood === 'wow' ? 8 : 7} fill="#2b2140" />
          <circle cx="66.5" cy="73" r="2.4" fill="#fff" />
          <circle cx="100.5" cy="73" r="2.4" fill="#fff" />
        </>
      )}
      {mood === 'wow' ? (
        <ellipse cx="81" cy="98" rx="7" ry="9" fill="#2b2140" />
      ) : (
        <path d="M70 94q11 12 22 0" stroke="#2b2140" strokeWidth="5" fill="none" strokeLinecap="round" />
      )}
      <ellipse cx="52" cy="92" rx="8" ry="5" fill="#ff8fc8" opacity=".55" />
      <ellipse cx="110" cy="92" rx="8" ry="5" fill="#ff8fc8" opacity=".55" />
      <path d="M134 98l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill="#ffd43b" />
      <path d="M22 54l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#7cc7ff" />
    </motion.svg>
  )
}

export function EmptyState({
  title,
  text,
  mood = 'sleepy',
  action,
}: {
  title: string
  text: ReactNode
  mood?: 'happy' | 'sleepy' | 'wow' | 'wink'
  action?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-3 rounded-4xl border-2 border-dashed border-line bg-surface/60 px-6 py-12 text-center"
    >
      <Mascot mood={mood} size={130} className="text-ink" />
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </motion.div>
  )
}

/** Ilustraciones del onboarding. */
export function StepArt({ step }: { step: 0 | 1 | 2 }) {
  if (step === 0)
    return (
      <svg viewBox="0 0 240 150" className="w-full max-w-xs" aria-hidden>
        <rect x="30" y="20" width="110" height="110" rx="24" fill="#ffe1f0" />
        <circle cx="70" cy="62" r="14" fill="#ffd43b" />
        <path d="M40 120l35-38 22 22 18-16 25 32z" fill="#ff8fc8" />
        <motion.g animate={{ x: [0, 10, 0], y: [0, -6, 0] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <rect x="130" y="50" width="80" height="80" rx="40" fill="#fff" stroke="#c4b0ff" strokeWidth="8" />
          <path d="M155 92l14-14 14 14" stroke="#a78bfa" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M169 80v28" stroke="#a78bfa" strokeWidth="8" strokeLinecap="round" />
        </motion.g>
      </svg>
    )
  if (step === 1)
    return (
      <svg viewBox="0 0 240 150" className="w-full max-w-xs" aria-hidden>
        <rect x="60" y="15" width="120" height="120" rx="28" fill="#fff" stroke="#ffb3d9" strokeWidth="8" />
        <motion.text x="120" y="88" textAnchor="middle" fontSize="40" fontWeight="900" fill="#ff4fa0" stroke="#fff" strokeWidth="2" animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ transformOrigin: '120px 75px' }}>
          ¡OK!
        </motion.text>
        <motion.path d="M30 40l5 10 10 5-10 5-5 10-5-10-10-5 10-5z" fill="#ffd43b" animate={{ rotate: [0, 180, 360] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '30px 55px' }} />
        <motion.path d="M205 95l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill="#7cc7ff" animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ transformOrigin: '205px 107px' }} />
      </svg>
    )
  return (
    <svg viewBox="0 0 240 150" className="w-full max-w-xs" aria-hidden>
      <rect x="70" y="10" width="100" height="130" rx="20" fill="#2b2140" />
      <rect x="78" y="22" width="84" height="106" rx="12" fill="#e7fff6" />
      <rect x="86" y="34" width="50" height="14" rx="7" fill="#fff" />
      <motion.g animate={{ y: [6, 0, 6] }} transition={{ duration: 2, repeat: Infinity }}>
        <rect x="104" y="60" width="50" height="50" rx="14" fill="#fff" stroke="#4cc9a6" strokeWidth="5" />
        <circle cx="120" cy="80" r="4" fill="#2b2140" />
        <circle cx="138" cy="80" r="4" fill="#2b2140" />
        <path d="M120 92q9 8 18 0" stroke="#2b2140" strokeWidth="4" fill="none" strokeLinecap="round" />
      </motion.g>
      <circle cx="196" cy="40" r="18" fill="#25d366" />
      <path d="M188 40l6 6 10-12" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Estado de carga bonito con la mascota. */
export function LoadingCard({ label, progress, detail }: { label: string; progress?: number; detail?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
      <Mascot mood="wow" size={96} />
      <p className="font-display text-lg font-semibold">{label}</p>
      {detail && <p className="text-sm text-muted">{detail}</p>}
      {progress !== undefined && (
        <div className="h-2.5 w-56 overflow-hidden rounded-full bg-surface-3">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-accent via-accent-2 to-sky" animate={{ width: `${Math.max(4, progress * 100)}%` }} />
        </div>
      )}
    </div>
  )
}
