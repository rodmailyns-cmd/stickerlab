import { motion } from 'framer-motion'
import { useState } from 'react'
import type { EmojiLayer, ShapeLayer } from '@/types/doc'
import { Chip, ColorField, Section, Slider } from '@/components/ui/Controls'
import { SHAPES, SHAPE_CATEGORIES, type ShapeCategory } from '@/lib/render/shapes'
import { newEmojiLayer, newShapeLayer } from '@/lib/doc/factory'
import { useEditor } from '@/store/editor'
import { ShadowControls, useSelectedLayer } from './common'

export const EMOJI_SETS: Record<string, string[]> = {
  Caritas: ['😀', '😂', '🤣', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😜', '🤪', '😇', '🙃', '😴', '🤔', '🫠', '😱', '😭', '😡', '🥺', '😏', '🤭', '🫡', '🤯', '😬', '🙄', '🤗', '😋'],
  Gestos: ['👍', '👎', '👌', '✌️', '🤞', '🫶', '👏', '🙌', '🙏', '💪', '👋', '🤙', '👉', '👈', '☝️', '🫵', '✊', '🤘'],
  Corazones: ['❤️', '🩷', '🧡', '💛', '💚', '🩵', '💙', '💜', '🖤', '🤍', '💖', '💗', '💓', '💞', '💕', '💘', '💔', '❤️‍🔥'],
  Brillos: ['✨', '⭐', '🌟', '💫', '⚡', '🔥', '💥', '🎉', '🎊', '🌈', '☀️', '🌙', '💎', '🫧', '🎀', '👑'],
  Animales: ['🐱', '🐶', '🐰', '🐻', '🐼', '🐨', '🦊', '🐸', '🐷', '🐥', '🦄', '🐙', '🦋', '🐢', '🐧', '🦖'],
  Cosas: ['🍕', '🍩', '🍦', '🧁', '☕', '🧋', '🍓', '🥑', '🎮', '🎧', '📱', '💤', '💯', '❗', '❓', '💬'],
}

function ShapeThumb({ path, fill, stroke }: { path: string; fill: string; stroke: string }) {
  return (
    <svg viewBox="-6 -6 112 112" className="size-full" aria-hidden>
      <path d={path} fill={fill} stroke={stroke} strokeWidth={5} strokeLinejoin="round" fillRule="evenodd" />
    </svg>
  )
}

export function ElementsPanel() {
  const sel = useSelectedLayer()
  const addLayer = useEditor((s) => s.addLayer)
  const updateLayer = useEditor((s) => s.updateLayer)
  const [cat, setCat] = useState<ShapeCategory>('formas')
  const [emojiSet, setEmojiSet] = useState('Caritas')

  const shape = sel?.type === 'shape' ? sel : null
  const emoji = sel?.type === 'emoji' ? sel : null
  const setShape = (r: (l: ShapeLayer) => void, key?: string) => shape && updateLayer<ShapeLayer>(shape.id, r as never, key ? { coalesce: `${shape.id}-${key}` } : undefined)
  const setEmoji = (r: (l: EmojiLayer) => void, key?: string) => emoji && updateLayer<EmojiLayer>(emoji.id, r as never, key ? { coalesce: `${emoji.id}-${key}` } : undefined)

  return (
    <div className="flex flex-col gap-5">
      {shape && (
        <Section title={`Editar: ${shape.name}`}>
          <ColorField label="Relleno" value={shape.fill} onChange={(c) => setShape((l) => void (l.fill = c), 'fill')} allowNone />
          <ColorField label="Borde" value={shape.stroke} onChange={(c) => setShape((l) => void (l.stroke = c), 'stroke')} />
          <Slider label="Grosor del borde" value={shape.strokeWidth} min={0} max={24} onChange={(v) => setShape((l) => void (l.strokeWidth = v), 'sw')} />
          <ShadowControls value={shape.shadow} onChange={(p, k) => setShape((l) => void Object.assign(l.shadow, p), k)} />
        </Section>
      )}
      {emoji && (
        <Section title={`Editar: ${emoji.emoji}`}>
          <Slider label="Tamaño" value={emoji.size} min={30} max={400} onChange={(v) => setEmoji((l) => void (l.size = v), 'size')} />
          <ShadowControls value={emoji.shadow} onChange={(p, k) => setEmoji((l) => void Object.assign(l.shadow, p), k)} />
        </Section>
      )}

      <Section title="Emojis">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {Object.keys(EMOJI_SETS).map((k) => (
            <Chip key={k} active={emojiSet === k} onClick={() => setEmojiSet(k)}>
              {k}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {EMOJI_SETS[emojiSet].map((e) => (
            <motion.button
              key={e}
              whileHover={{ scale: 1.2, rotate: -8 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => (emoji ? setEmoji((l) => void ((l.emoji = e), (l.name = `Emoji ${e}`))) : addLayer(newEmojiLayer(e)))}
              className="grid aspect-square place-items-center rounded-xl text-[26px] hover:bg-surface-3 cursor-pointer"
              aria-label={`Añadir ${e}`}
            >
              {e}
            </motion.button>
          ))}
        </div>
      </Section>

      <Section title="Decoraciones">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SHAPE_CATEGORIES.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SHAPES.filter((s) => s.category === cat).map((s) => (
            <motion.button
              key={s.id}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.92 }}
              title={s.label}
              aria-label={`Añadir ${s.label}`}
              onClick={() => addLayer(newShapeLayer(s.id, s.category === 'marcos' ? 480 : 200))}
              className="aspect-square rounded-2xl border border-line bg-surface-2 p-2 hover:border-accent/50 cursor-pointer"
            >
              <ShapeThumb path={s.path} fill={s.fill} stroke={s.stroke} />
            </motion.button>
          ))}
        </div>
      </Section>
    </div>
  )
}
