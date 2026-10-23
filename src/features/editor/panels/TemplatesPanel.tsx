import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Section } from '@/components/ui/Controls'
import { TEMPLATES, type Template } from '@/lib/doc/templates'
import { renderPreview } from '@/lib/render/exporter'
import { useEditor } from '@/store/editor'
import { toast } from '@/store/ui'

const previews = new Map<string, string>()

function TemplateCard({ t, onPick }: { t: Template; onPick: (t: Template) => void }) {
  const [src, setSrc] = useState(previews.get(t.id) ?? null)
  useEffect(() => {
    if (src) return
    let alive = true
    void renderPreview(t.build(), 160).then((c) => {
      const url = c.toDataURL('image/png')
      previews.set(t.id, url)
      if (alive) setSrc(url)
    })
    return () => {
      alive = false
    }
  }, [t, src])
  return (
    <motion.button
      whileHover={{ y: -3, rotate: -1 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onPick(t)}
      className="group flex flex-col items-center gap-1 cursor-pointer"
      aria-label={`Usar ${t.label}`}
    >
      <span className="checker block aspect-square w-full overflow-hidden rounded-2xl border border-line group-hover:border-accent/50">
        {src ? <img src={src} alt="" className="size-full object-contain" /> : <span className="block size-full animate-pulse bg-surface-3" />}
      </span>
      <span className="text-xs font-bold">{t.label}</span>
    </motion.button>
  )
}

export function TemplatesPanel() {
  const pick = (t: Template) => {
    const st = useEditor.getState()
    const d = t.build()
    if (st.doc.layers.length === 0) {
      st.loadDoc(d, null)
    } else {
      // Añade las capas de la plantilla encima del trabajo actual
      st.setDoc((doc) => {
        doc.layers.push(...d.layers)
        if (d.animated) {
          doc.animated = true
          doc.duration = Math.max(doc.duration, d.duration)
        }
      })
    }
    toast(`Plantilla "${t.label}" aplicada`, 'success')
  }
  return (
    <div className="flex flex-col gap-5">
      <Section title="Reacciones rápidas">
        <p className="-mt-1 text-xs text-muted">Stickers animados listos en un clic. Luego puedes cambiarles todo.</p>
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.filter((t) => t.kind === 'reaccion').map((t) => (
            <TemplateCard key={t.id} t={t} onPick={pick} />
          ))}
        </div>
      </Section>
      <Section title="Memes y marcos">
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.filter((t) => t.kind === 'plantilla').map((t) => (
            <TemplateCard key={t.id} t={t} onPick={pick} />
          ))}
        </div>
      </Section>
    </div>
  )
}
