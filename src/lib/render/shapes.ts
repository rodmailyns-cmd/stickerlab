/** Biblioteca de formas decorativas. Todas en una caja de 100×100. */

export type ShapeCategory = 'formas' | 'flechas' | 'corazones' | 'brillos' | 'burbujas' | 'marcos'

export interface ShapeDef {
  id: string
  label: string
  category: ShapeCategory
  path: string
  fill: string
  stroke: string
  strokeWidth: number
}

function f(n: number) {
  return Math.round(n * 100) / 100
}

export function starPath(points: number, outer: number, inner: number, cx = 50, cy = 50, rot = -Math.PI / 2): string {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = rot + (i * Math.PI) / points
    d += `${i === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)} `
  }
  return d + 'Z'
}

/** Corazón dentro de la caja (x, y, w, h). */
export function heartPath(x = 0, y = 0, w = 100, h = 100): string {
  const X = (v: number) => f(x + (v / 100) * w)
  const Y = (v: number) => f(y + (v / 100) * h)
  return `M${X(50)} ${Y(92)} C${X(20)} ${Y(70)} ${X(2)} ${Y(52)} ${X(2)} ${Y(32)} C${X(2)} ${Y(14)} ${X(16)} ${Y(4)} ${X(30)} ${Y(4)} C${X(40)} ${Y(4)} ${X(47)} ${Y(9)} ${X(50)} ${Y(17)} C${X(53)} ${Y(9)} ${X(60)} ${Y(4)} ${X(70)} ${Y(4)} C${X(84)} ${Y(4)} ${X(98)} ${Y(14)} ${X(98)} ${Y(32)} C${X(98)} ${Y(52)} ${X(80)} ${Y(70)} ${X(50)} ${Y(92)} Z`
}

function circlePath(cx: number, cy: number, r: number, ccw = false): string {
  const s = ccw ? 0 : 1
  return `M${f(cx - r)} ${cy} A${r} ${r} 0 1 ${s} ${f(cx + r)} ${cy} A${r} ${r} 0 1 ${s} ${f(cx - r)} ${cy} Z`
}

export function roundedRectPath(x: number, y: number, w: number, h: number, r: number, ccw = false): string {
  const rr = Math.min(r, w / 2, h / 2)
  if (!ccw) {
    return `M${x + rr} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h - rr} Q${x + w} ${y + h} ${x + w - rr} ${y + h} H${x + rr} Q${x} ${y + h} ${x} ${y + h - rr} V${y + rr} Q${x} ${y} ${x + rr} ${y} Z`
  }
  return `M${x + rr} ${y} Q${x} ${y} ${x} ${y + rr} V${y + h - rr} Q${x} ${y + h} ${x + rr} ${y + h} H${x + w - rr} Q${x + w} ${y + h} ${x + w} ${y + h - rr} V${y + rr} Q${x + w} ${y} ${x + w - rr} ${y} Z`
}

function scallopPath(cx: number, cy: number, r: number, bumps: number, depth: number): string {
  let d = ''
  for (let i = 0; i <= bumps * 8; i++) {
    const a = (i / (bumps * 8)) * Math.PI * 2
    const rr = r + Math.abs(Math.sin((a * bumps) / 2)) * depth
    d += `${i === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)} `
  }
  return d + 'Z'
}

const SPARKLE = 'M50 2 C54 34 66 46 98 50 C66 54 54 66 50 98 C46 66 34 54 2 50 C34 46 46 34 50 2 Z'

export const SHAPES: ShapeDef[] = [
  // Formas básicas
  { id: 'circle', label: 'Círculo', category: 'formas', path: circlePath(50, 50, 48), fill: '#ffd166', stroke: '#ffffff', strokeWidth: 6 },
  { id: 'rounded', label: 'Cuadrado redondo', category: 'formas', path: roundedRectPath(2, 2, 96, 96, 24), fill: '#a0e7e5', stroke: '#ffffff', strokeWidth: 6 },
  { id: 'star', label: 'Estrella', category: 'formas', path: starPath(5, 48, 22), fill: '#ffd166', stroke: '#ffffff', strokeWidth: 6 },
  { id: 'burst', label: 'Explosión', category: 'formas', path: starPath(14, 49, 34), fill: '#ff6b6b', stroke: '#ffe66d', strokeWidth: 6 },
  { id: 'blob', label: 'Nube', category: 'formas', path: 'M28 82 C10 82 4 66 12 56 C4 42 16 28 30 32 C32 14 56 8 64 24 C78 14 96 26 90 44 C102 54 94 78 76 78 C70 90 40 92 28 82 Z', fill: '#ffffff', stroke: '#cdb4ff', strokeWidth: 6 },
  { id: 'bolt', label: 'Rayo', category: 'formas', path: 'M58 2 L18 56 L46 56 L38 98 L84 38 L54 38 Z', fill: '#ffe066', stroke: '#ff9f1c', strokeWidth: 5 },
  { id: 'crown', label: 'Corona', category: 'formas', path: 'M6 80 L12 26 L34 50 L50 14 L66 50 L88 26 L94 80 Z', fill: '#ffd166', stroke: '#e09f3e', strokeWidth: 5 },
  { id: 'drop', label: 'Gota', category: 'formas', path: 'M50 4 C66 30 84 48 84 66 C84 84 68 96 50 96 C32 96 16 84 16 66 C16 48 34 30 50 4 Z', fill: '#74c0fc', stroke: '#ffffff', strokeWidth: 5 },
  { id: 'flower', label: 'Flor', category: 'formas', path: scallopPath(50, 50, 30, 6, 18), fill: '#ffafcc', stroke: '#ffffff', strokeWidth: 5 },
  { id: 'note', label: 'Nota musical', category: 'formas', path: 'M40 10 L88 2 L88 70 C88 82 74 88 66 84 C56 80 58 66 70 62 C74 61 78 62 80 63 L80 22 L48 28 L48 80 C48 92 34 98 26 94 C16 90 18 76 30 72 C34 71 38 72 40 73 Z', fill: '#9d4edd', stroke: '#ffffff', strokeWidth: 4 },
  // Flechas
  { id: 'arrow', label: 'Flecha', category: 'flechas', path: 'M4 38 H58 V14 L96 50 L58 86 V62 H4 Z', fill: '#ff6b6b', stroke: '#ffffff', strokeWidth: 5 },
  { id: 'arrow-up', label: 'Flecha arriba', category: 'flechas', path: 'M38 96 V42 H14 L50 4 L86 42 H62 V96 Z', fill: '#4dabf7', stroke: '#ffffff', strokeWidth: 5 },
  { id: 'arrow-curve', label: 'Flecha curva', category: 'flechas', path: 'M10 86 C10 40 40 20 70 20 V4 L98 30 L70 56 V40 C46 40 30 56 28 86 Z', fill: '#51cf66', stroke: '#ffffff', strokeWidth: 5 },
  { id: 'arrow-double', label: 'Doble flecha', category: 'flechas', path: 'M2 50 L28 22 V38 H72 V22 L98 50 L72 78 V62 H28 V78 Z', fill: '#f783ac', stroke: '#ffffff', strokeWidth: 5 },
  { id: 'chevron', label: 'Chevron', category: 'flechas', path: 'M20 8 L60 50 L20 92 L40 92 L80 50 L40 8 Z', fill: '#ffa94d', stroke: '#ffffff', strokeWidth: 4 },
  // Corazones
  { id: 'heart', label: 'Corazón', category: 'corazones', path: heartPath(), fill: '#ff5d8f', stroke: '#ffffff', strokeWidth: 6 },
  { id: 'heart-pastel', label: 'Corazón pastel', category: 'corazones', path: heartPath(), fill: '#ffc8dd', stroke: '#ff8fab', strokeWidth: 5 },
  { id: 'heart-broken', label: 'Corazón roto', category: 'corazones', path: 'M50 92 C20 70 2 52 2 32 C2 14 16 4 30 4 C40 4 47 9 50 17 L42 36 L56 48 L44 66 Z M54 88 L62 64 L50 50 L62 34 L52 15 C56 8 62 4 70 4 C84 4 98 14 98 32 C98 52 80 70 54 88 Z', fill: '#ff4d6d', stroke: '#ffffff', strokeWidth: 5 },
  { id: 'hearts', label: 'Corazones', category: 'corazones', path: heartPath(0, 20, 60, 60) + ' ' + heartPath(56, 0, 44, 44) + ' ' + heartPath(60, 58, 34, 34), fill: '#ff85a1', stroke: '#ffffff', strokeWidth: 4 },
  // Brillos
  { id: 'sparkle', label: 'Destello', category: 'brillos', path: SPARKLE, fill: '#ffe066', stroke: '#ffffff', strokeWidth: 4 },
  { id: 'sparkles', label: 'Destellos', category: 'brillos', path: 'M38 6 C41 30 50 38 72 41 C50 44 41 52 38 76 C35 52 26 44 4 41 C26 38 35 30 38 6 Z M78 54 C80 68 84 72 96 74 C84 76 80 80 78 94 C76 80 72 76 60 74 C72 72 76 68 78 54 Z M80 4 C81 12 84 15 92 16 C84 17 81 20 80 28 C79 20 76 17 68 16 C76 15 79 12 80 4 Z', fill: '#fff3b0', stroke: '#ffd43b', strokeWidth: 3 },
  { id: 'star4', label: 'Estrella 4', category: 'brillos', path: starPath(4, 48, 14, 50, 50), fill: '#b197fc', stroke: '#ffffff', strokeWidth: 4 },
  { id: 'star-small', label: 'Estrellita', category: 'brillos', path: starPath(5, 48, 26), fill: '#ffd43b', stroke: '#fff9db', strokeWidth: 4 },
  { id: 'sun', label: 'Sol', category: 'brillos', path: starPath(12, 49, 38) + ' ' + circlePath(50, 50, 30), fill: '#ffc078', stroke: '#ffffff', strokeWidth: 4 },
  // Burbujas
  { id: 'bubble', label: 'Burbuja', category: 'burbujas', path: 'M50 6 C78 6 96 22 96 42 C96 62 78 78 50 78 C44 78 38 77 33 75 L12 94 L18 70 C8 62 4 52 4 42 C4 22 22 6 50 6 Z', fill: '#ffffff', stroke: '#222222', strokeWidth: 4 },
  { id: 'bubble-rect', label: 'Bocadillo', category: 'burbujas', path: 'M14 6 H86 Q96 6 96 16 V62 Q96 72 86 72 H40 L18 94 L24 72 H14 Q4 72 4 62 V16 Q4 6 14 6 Z', fill: '#ffffff', stroke: '#222222', strokeWidth: 4 },
  { id: 'thought', label: 'Pensamiento', category: 'burbujas', path: 'M30 66 C14 66 6 56 10 46 C2 36 12 22 26 24 C28 10 48 4 58 14 C70 4 92 12 90 28 C100 36 96 56 82 58 C80 70 62 74 54 66 C46 72 36 72 30 66 Z ' + circlePath(20, 82, 7) + ' ' + circlePath(8, 95, 4), fill: '#ffffff', stroke: '#222222', strokeWidth: 4 },
  { id: 'shout', label: 'Grito', category: 'burbujas', path: starPath(16, 49, 36), fill: '#ffe066', stroke: '#222222', strokeWidth: 4 },
  // Marcos (con hueco)
  { id: 'frame-circle', label: 'Marco círculo', category: 'marcos', path: circlePath(50, 50, 49) + ' ' + circlePath(50, 50, 42, true), fill: '#ffffff', stroke: '#ffafcc', strokeWidth: 3 },
  { id: 'frame-rounded', label: 'Marco redondo', category: 'marcos', path: roundedRectPath(1, 1, 98, 98, 22) + ' ' + roundedRectPath(8, 8, 84, 84, 16, true), fill: '#ffffff', stroke: '#bde0fe', strokeWidth: 3 },
  { id: 'frame-polaroid', label: 'Polaroid', category: 'marcos', path: roundedRectPath(1, 1, 98, 98, 4) + ' ' + roundedRectPath(8, 8, 84, 70, 2, true), fill: '#ffffff', stroke: '#e9ecef', strokeWidth: 2 },
  { id: 'frame-heart', label: 'Marco corazón', category: 'marcos', path: heartPath(0, 0, 100, 100) + ' ' + reverseHeart(), fill: '#ff8fab', stroke: '#ffffff', strokeWidth: 3 },
  { id: 'frame-scallop', label: 'Marco ondas', category: 'marcos', path: scallopPath(50, 50, 44, 12, 5) + ' ' + circlePath(50, 50, 40, true), fill: '#cdb4db', stroke: '#ffffff', strokeWidth: 3 },
  { id: 'frame-star', label: 'Marco estrella', category: 'marcos', path: starPath(5, 49, 26) + ' ' + circlePath(50, 54, 18, true), fill: '#ffd166', stroke: '#ffffff', strokeWidth: 3 },
]

function reverseHeart(): string {
  // Corazón interior dibujado en sentido contrario para hacer el hueco
  const x = 12, y = 14, w = 76, h = 70
  const X = (v: number) => f(x + (v / 100) * w)
  const Y = (v: number) => f(y + (v / 100) * h)
  return `M${X(50)} ${Y(92)} C${X(80)} ${Y(70)} ${X(98)} ${Y(52)} ${X(98)} ${Y(32)} C${X(98)} ${Y(14)} ${X(84)} ${Y(4)} ${X(70)} ${Y(4)} C${X(60)} ${Y(4)} ${X(53)} ${Y(9)} ${X(50)} ${Y(17)} C${X(47)} ${Y(9)} ${X(40)} ${Y(4)} ${X(30)} ${Y(4)} C${X(16)} ${Y(4)} ${X(2)} ${Y(14)} ${X(2)} ${Y(32)} C${X(2)} ${Y(52)} ${X(20)} ${Y(70)} ${X(50)} ${Y(92)} Z`
}

export function shapeById(id: string): ShapeDef {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0]
}

export const SHAPE_CATEGORIES: { id: ShapeCategory; label: string }[] = [
  { id: 'formas', label: 'Formas' },
  { id: 'flechas', label: 'Flechas' },
  { id: 'corazones', label: 'Corazones' },
  { id: 'brillos', label: 'Brillos' },
  { id: 'burbujas', label: 'Burbujas' },
  { id: 'marcos', label: 'Marcos' },
]

/** Forma de recorte como Path2D para una caja w×h. */
export function cropPath(shape: string, w: number, h: number, radius: number, lasso: number[]): Path2D | null {
  switch (shape) {
    case 'circle': {
      const p = new Path2D()
      p.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      return p
    }
    case 'rounded': {
      const p = new Path2D()
      const r = Math.min(w, h) * (radius / 100) * 0.5
      p.roundRect(0, 0, w, h, r)
      return p
    }
    case 'heart':
      return new Path2D(heartPath(0, 0, w, h))
    case 'star': {
      const s = Math.min(w, h) / 100
      const p = new Path2D()
      p.addPath(new Path2D(starPath(5, 50, 24)), new DOMMatrix().translate((w - 100 * s) / 2, (h - 100 * s) / 2).scale(s))
      return p
    }
    case 'lasso': {
      if (lasso.length < 6) return null
      const p = new Path2D()
      p.moveTo(lasso[0], lasso[1])
      for (let i = 2; i < lasso.length; i += 2) p.lineTo(lasso[i], lasso[i + 1])
      p.closePath()
      return p
    }
    default:
      return null
  }
}
