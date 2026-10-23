import { NO_SHADOW, type Layer, type StickerDoc } from '@/types/doc'
import { newDoc, newEmojiLayer, newShapeLayer, newTextLayer } from './factory'

export interface Template {
  id: string
  label: string
  kind: 'plantilla' | 'reaccion'
  build: () => StickerDoc
}

function doc(name: string, layers: Layer[], animated = false, duration = 2): StickerDoc {
  const d = newDoc(name)
  d.layers = layers
  d.animated = animated
  d.duration = duration
  return d
}

const at = <T extends Layer>(l: T, x: number, y: number, extra: Partial<T> = {}): T => Object.assign(l, { x, y }, extra)
const anim = <T extends Layer>(l: T, ...presets: Array<[Layer['animations'][number]['preset'], number?, number?]>): T => {
  l.animations = presets.map(([preset, speed = 1, intensity = 1]) => ({ preset, speed, intensity }))
  return l
}
const glow = { ...NO_SHADOW, enabled: true, color: '#000000', blur: 0, offsetX: 0, offsetY: 6, opacity: 0.35 }

export const TEMPLATES: Template[] = [
  {
    id: 'meme',
    label: 'Meme clásico',
    kind: 'plantilla',
    build: () =>
      doc('Meme', [
        at(newTextLayer('CUANDO ALGO', { fontFamily: 'Anton', fill: '#ffffff', stroke: '#000000', strokeWidth: 10, bold: false, fontSize: 62 }), 256, 60),
        at(newTextLayer('POR FIN FUNCIONA', { fontFamily: 'Anton', fill: '#ffffff', stroke: '#000000', strokeWidth: 10, bold: false, fontSize: 62 }), 256, 452),
      ]),
  },
  {
    id: 'heart-frame',
    label: 'Marco corazón',
    kind: 'plantilla',
    build: () => doc('Marco corazón', [at(newShapeLayer('frame-heart', 500), 256, 256), at(anim(newEmojiLayer('💖', 70), ['float']), 420, 80)]),
  },
  {
    id: 'polaroid',
    label: 'Polaroid',
    kind: 'plantilla',
    build: () =>
      doc('Polaroid', [
        at(newShapeLayer('frame-polaroid', 480), 256, 256, { rotation: -4, shadow: { ...glow, blur: 18, offsetY: 8, opacity: 0.25 } }),
        at(newTextLayer('¡qué día!', { fontFamily: 'Caveat', fill: '#2b2d42', stroke: '#ffffff', strokeWidth: 0, fontSize: 56, bold: true }), 250, 440, { rotation: -4 }),
      ]),
  },
  {
    id: 'bubble',
    label: 'Bocadillo',
    kind: 'plantilla',
    build: () =>
      doc('Bocadillo', [
        at(newShapeLayer('bubble', 440), 256, 236),
        at(newTextLayer('¡Hola!', { fontFamily: 'Fredoka', fill: '#2b2d42', stroke: '#ffffff', strokeWidth: 0, fontSize: 90 }), 256, 200),
      ]),
  },
  {
    id: 'pow',
    label: '¡POW!',
    kind: 'plantilla',
    build: () =>
      doc(
        'POW',
        [
          anim(at(newShapeLayer('burst', 470), 256, 256), ['heartbeat', 1, 0.6]),
          anim(at(newTextLayer('POW!', { fontFamily: 'Bangers', fill: '#ffd43b', stroke: '#1a1a1a', strokeWidth: 12, fontSize: 150, bold: false, shadow: { ...glow, color: '#1a1a1a', offsetX: 8, offsetY: 8, opacity: 1 } }), 256, 260, { rotation: -8 }), ['shake', 1, 0.6]),
        ],
        true,
        1,
      ),
  },
  {
    id: 'badge',
    label: 'Insignia',
    kind: 'plantilla',
    build: () =>
      doc('Insignia', [
        at(newShapeLayer('frame-scallop', 480), 256, 256),
        at(newShapeLayer('circle', 380), 256, 256, { fill: '#fff0f6', stroke: '#ffffff', strokeWidth: 0 } as never),
        at(newTextLayer('MI SQUAD', { fontFamily: 'Titan One', fill: '#ff5d8f', stroke: '#ffffff', strokeWidth: 8, fontSize: 54, bold: false, curve: 45 }), 256, 150),
        at(newEmojiLayer('😎', 170), 256, 290),
      ]),
  },
  {
    id: 'sparkle-frame',
    label: 'Brillitos',
    kind: 'plantilla',
    build: () =>
      doc(
        'Brillitos',
        [
          anim(at(newShapeLayer('sparkle', 90), 80, 90), ['shine'], ['spin', 0.5]),
          anim(at(newShapeLayer('sparkles', 110), 430, 420), ['shine', 1.5]),
          anim(at(newShapeLayer('star4', 70), 440, 90), ['heartbeat']),
        ],
        true,
        2,
      ),
  },
  // Reacciones rápidas (animadas)
  {
    id: 'r-jaja',
    label: 'JAJAJA',
    kind: 'reaccion',
    build: () =>
      doc('JAJAJA', [anim(at(newEmojiLayer('😂', 220), 256, 210), ['bounce']), anim(at(newTextLayer('JAJAJA', { fontFamily: 'Bangers', fill: '#ffd43b', stroke: '#1a1a1a', strokeWidth: 12, fontSize: 110, bold: false }), 256, 420), ['shake', 1, 0.7])], true, 1.4),
  },
  {
    id: 'r-ok',
    label: 'OK 👍',
    kind: 'reaccion',
    build: () => doc('OK', [anim(at(newEmojiLayer('👍', 260), 256, 220), ['heartbeat']), at(newTextLayer('¡OK!', { fontFamily: 'Titan One', fill: '#51cf66', stroke: '#ffffff', strokeWidth: 14, fontSize: 120, bold: false, shadow: glow }), 256, 420)], true, 1.6),
  },
  {
    id: 'r-gracias',
    label: '¡Gracias!',
    kind: 'reaccion',
    build: () =>
      doc(
        'Gracias',
        [
          anim(at(newShapeLayer('heart', 120), 110, 120), ['float']),
          anim(at(newShapeLayer('heart-pastel', 90), 410, 140), ['float', 1, 1.3]),
          anim(at(newTextLayer('¡Gracias!', { fontFamily: 'Pacifico', fill: '#ff5d8f', stroke: '#ffffff', strokeWidth: 14, fontSize: 96, bold: false, shadow: glow }), 256, 300), ['heartbeat', 1, 0.5]),
        ],
        true,
        2,
      ),
  },
  {
    id: 'r-que',
    label: '¿QUÉ?',
    kind: 'reaccion',
    build: () => doc('Qué', [anim(at(newEmojiLayer('😱', 240), 256, 220), ['zoom']), at(newTextLayer('¿¡QUÉ!?', { fontFamily: 'Anton', fill: '#ffffff', stroke: '#000000', strokeWidth: 12, fontSize: 110, bold: false }), 256, 430)], true, 1),
  },
  {
    id: 'r-buenos',
    label: 'Buenos días',
    kind: 'reaccion',
    build: () =>
      doc(
        'Buenos días',
        [anim(at(newEmojiLayer('☀️', 220), 256, 200), ['spin', 0.5]), anim(at(newTextLayer('¡Buenos días!', { fontFamily: 'Fredoka', fill: '#ffa94d', stroke: '#ffffff', strokeWidth: 14, fontSize: 76, shadow: glow }), 256, 420), ['float', 1, 0.5])],
        true,
        2,
      ),
  },
  {
    id: 'r-love',
    label: 'Te quiero',
    kind: 'reaccion',
    build: () => doc('Te quiero', [anim(at(newEmojiLayer('❤️', 260), 256, 220), ['heartbeat', 1, 1.3]), at(newTextLayer('te quiero', { fontFamily: 'Dancing Script', fill: '#ff4d6d', stroke: '#ffffff', strokeWidth: 12, fontSize: 96, shadow: glow }), 256, 430)], true, 1.6),
  },
  {
    id: 'r-nooo',
    label: 'Nooo',
    kind: 'reaccion',
    build: () => doc('Nooo', [anim(at(newEmojiLayer('😭', 250), 256, 220), ['shake']), at(newTextLayer('NOOOO', { fontFamily: 'Luckiest Guy', fill: '#74c0fc', stroke: '#1b1b2f', strokeWidth: 12, fontSize: 110, bold: false }), 256, 430)], true, 1),
  },
  {
    id: 'r-fiesta',
    label: '¡Fiesta!',
    kind: 'reaccion',
    build: () =>
      doc(
        'Fiesta',
        [anim(at(newEmojiLayer('🎉', 230), 256, 210), ['pendulum']), anim(at(newTextLayer('¡FIESTA!', { fontFamily: 'Titan One', fill: '#ff5d8f', stroke: '#ffffff', strokeWidth: 14, fontSize: 100, bold: false }), 256, 420), ['rainbow'])],
        true,
        2,
      ),
  },
  {
    id: 'r-bye',
    label: 'Adiós 👋',
    kind: 'reaccion',
    build: () => doc('Adiós', [anim(at(newEmojiLayer('👋', 250), 256, 220), ['pendulum', 1.5, 1.2]), at(newTextLayer('¡Chaooo!', { fontFamily: 'Chewy', fill: '#9775fa', stroke: '#ffffff', strokeWidth: 14, fontSize: 100 }), 256, 430)], true, 1.4),
  },
  {
    id: 'r-wow',
    label: 'WOW',
    kind: 'reaccion',
    build: () =>
      doc(
        'WOW',
        [
          anim(at(newShapeLayer('sparkles', 140), 100, 110), ['shine', 2]),
          anim(at(newEmojiLayer('🤩', 220), 256, 230), ['appear']),
          anim(at(newTextLayer('WOW', { fontFamily: 'Bungee', fill: '#ffd43b', stroke: '#2b2d42', strokeWidth: 12, fontSize: 120, bold: false }), 256, 430), ['shine', 1, 1.5]),
        ],
        true,
        2,
      ),
  },
]
