// Copia las fuentes de @fontsource a public/fonts/ (solo latin y latin-ext, woff2) para que el editor
// funcione sin internet. Genera un CSS por familia: public/fonts/<slug>.css
import fs from 'node:fs'
import path from 'node:path'

const DST = path.resolve('public/fonts')
const src = fs.readFileSync('src/lib/render/fonts.ts', 'utf8')
const fonts = [...src.matchAll(/family: '([^']+)'.*?weights: \[([\d, ]+)\](, italic: true)?/g)].map((m) => ({
  family: m[1],
  weights: m[2].split(',').map((w) => Number(w.trim())),
  italic: !!m[3],
}))
// Pesos extra que usa la interfaz
const UI_EXTRA = { Nunito: [600, 700], Fredoka: [600] }

export const slug = (family) => family.toLowerCase().replace(/ /g, '-')
fs.mkdirSync(path.join(DST, 'files'), { recursive: true })
let files = 0
for (const f of fonts) {
  const pkg = path.resolve('node_modules/@fontsource', slug(f.family))
  const weights = [...new Set([...f.weights, ...(UI_EXTRA[f.family] ?? [])])]
  const styles = f.italic ? ['', '-italic'] : ['']
  let css = ''
  for (const w of weights) {
    for (const s of styles) {
      const file = path.join(pkg, `${w}${s}.css`)
      if (!fs.existsSync(file)) {
        console.warn(`Falta ${f.family} ${w}${s}`)
        continue
      }
      const blocks = fs.readFileSync(file, 'utf8').split(/(?=\/\* )/)
      for (const b of blocks) {
        if (!/-(latin|latin-ext)-\d+-(normal|italic) \*\//.test(b)) continue
        const woff2 = b.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1]
        if (!woff2) continue
        fs.copyFileSync(path.join(pkg, 'files', woff2), path.join(DST, 'files', woff2))
        files++
        css += b.replace(/src: [^;]+;/, `src: url(./files/${woff2}) format('woff2');`).trim() + '\n'
      }
    }
  }
  fs.writeFileSync(path.join(DST, `${slug(f.family)}.css`), css)
}
console.log(`Fuentes listas en public/fonts (${fonts.length} familias, ${files} archivos)`)
