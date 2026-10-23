// Copia el modelo de "quitar fondo" y el runtime ONNX a public/imgly/ para que funcione sin internet
// (en la web y dentro del APK). Solo copia lo necesario: modelo "small" y los WASM sin hilos.
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('node_modules/@imgly/background-removal-data/dist')
const DST = path.resolve('public/imgly')
const KEYS = ['/models/small', '/onnxruntime-web/ort-wasm-simd.wasm', '/onnxruntime-web/ort-wasm.wasm']

const all = JSON.parse(fs.readFileSync(path.join(SRC, 'resources.json'), 'utf8'))
const picked = Object.fromEntries(KEYS.map((k) => [k, all[k]]))
fs.mkdirSync(DST, { recursive: true })
let bytes = 0
for (const res of Object.values(picked)) {
  for (const chunk of res.chunks) {
    const to = path.join(DST, chunk.hash)
    if (!fs.existsSync(to)) fs.copyFileSync(path.join(SRC, chunk.hash), to)
    bytes += fs.statSync(to).size
  }
}
fs.writeFileSync(path.join(DST, 'resources.json'), JSON.stringify(picked))
console.log(`Modelo de quitar fondo listo en public/imgly (${(bytes / 1048576).toFixed(1)} MB)`)
