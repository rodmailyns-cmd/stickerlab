// Prueba de punta a punta en Chromium: crea stickers estáticos y animados desde la interfaz,
// arma dos packs, los exporta y guarda los archivos en e2e-output/ para validarlos con
// `npm run test:output`.
// Uso: npm run build && npm run preview  (en otra terminal)  →  npm run e2e
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = path.resolve('e2e-output')
const SHOTS = process.env.SHOTS || path.join(OUT, 'screens')
fs.mkdirSync(SHOTS, { recursive: true })

const executablePath = process.env.CHROMIUM_PATH || undefined
const browser = await chromium.launch({ executablePath })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
await ctx.addInitScript(() => localStorage.setItem('sl-onboarded', '1'))
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())

const log = (...a) => console.log('•', ...a)
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) })

await page.goto(BASE, { waitUntil: 'networkidle' })

/** Foto sintética con mucho detalle (el peor caso para el peso del archivo). */
const photo = await page.evaluate(() => {
  const c = document.createElement('canvas')
  c.width = c.height = 1024
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 1024, 1024)
  grad.addColorStop(0, '#ff9a9e')
  grad.addColorStop(0.5, '#fad0c4')
  grad.addColorStop(1, '#a18cd1')
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 1024)
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `hsla(${(i * 37) % 360},80%,60%,0.5)`
    g.beginPath()
    g.arc(Math.random() * 1024, Math.random() * 1024, 10 + Math.random() * 60, 0, Math.PI * 2)
    g.fill()
  }
  const img = g.getImageData(0, 0, 1024, 1024)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 70
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  return c.toDataURL('image/png').split(',')[1]
})
const photoFile = { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') }

async function importPhoto() {
  await page.getByRole('button', { name: 'Importar', exact: true }).first().click()
  await page.locator('input[type=file][accept="image/*,video/*"]').setInputFiles(photoFile)
  await page.getByText('Imagen añadida').first().waitFor({ timeout: 20000 })
}

async function saveSticker(name) {
  await page.getByRole('button', { name: /Guardar/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre').fill(name)
  await dialog.getByRole('button', { name: /Guardar sticker|Actualizar sticker/ }).click()
  await dialog.getByText('¡Sticker guardado!').waitFor({ timeout: 180000 })
  const info = await dialog.locator('span.rounded-full').allInnerTexts()
  log(`Guardado "${name}":`, info.join(' | '))
  await shot(`save-${name}`)
  await dialog.getByRole('button', { name: 'Seguir creando' }).click()
}

async function newSticker() {
  await page.getByRole('button', { name: 'Más opciones del proyecto' }).click()
  await page.getByRole('menuitem', { name: 'Nuevo sticker' }).click()
}

/** Mueve un slider (input range) como lo haría el usuario. */
async function setRange(locator, value) {
  await locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

const panel = (name) => page.locator('nav[aria-label="Herramientas"]').first().getByRole('button', { name, exact: true }).click()

// 1) Estático: foto con contorno + texto meme
await importPhoto()
await panel('Recorte')
await page.getByRole('button', { name: 'Círculo' }).click()
await setRange(page.getByLabel('Grosor').first(), 14)
await panel('Texto')
await page.getByRole('button', { name: 'Meme clásico' }).click()
await page.waitForTimeout(1500)
await shot('editor-static')
await saveSticker('Foto meme')

// 2) Animado desde plantilla de reacción
await newSticker()
await panel('Plantillas')
await page.getByRole('button', { name: 'Usar JAJAJA' }).click()
await page.waitForTimeout(1200)
await shot('editor-template')
await saveSticker('Jajaja')

// 3) Animado "peor caso": foto con ruido girando, 30 FPS, 10 s → el optimizador debe bajar de 500 KB
await newSticker()
await importPhoto()
await panel('Animar')
await page.getByRole('button', { name: /Giro/ }).click()
await setRange(page.getByLabel('Fotogramas por segundo'), 30)
await setRange(page.getByLabel('Duración'), 10)
await page.waitForTimeout(500)
await shot('editor-animated')
await saveSticker('Foto giratoria')

// 4) Otro animado (latido)
await newSticker()
await panel('Plantillas')
await page.getByRole('button', { name: 'Usar Te quiero' }).click()
await saveSticker('Te quiero')

// Biblioteca: duplica el estático para tener 3
await page.getByRole('button', { name: /Biblioteca/ }).click()
await page.waitForTimeout(600)
const staticCard = page.locator('article', { hasText: 'Foto meme' }).first()
await staticCard.getByRole('button', { name: 'Duplicar' }).click()
await page.waitForTimeout(400)
await staticCard.getByRole('button', { name: 'Duplicar' }).click()
await page.waitForTimeout(800)
await shot('library')

async function buildPack(kindButton, title) {
  await page.getByRole('button', { name: /Packs/ }).first().click()
  await page.getByRole('button', { name: kindButton }).click()
  await page.getByLabel('Nombre del pack').fill(title)
  await page.getByLabel('Autor').fill('StickerLab E2E')
  await page.getByRole('button', { name: 'Guardar nombre y autor' }).click()
  await page.getByRole('button', { name: 'Añadir', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  for (const b of await dialog.locator('button[aria-pressed]').all()) await b.click()
  await dialog.getByRole('button', { name: 'Añadir', exact: true }).click()
  await page.waitForTimeout(1500)
  await shot(`pack-${title}`)
  const dl1 = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar .wastickers' }).click()
  const d1 = await dl1
  await d1.saveAs(path.join(OUT, d1.suggestedFilename()))
  const dl2 = page.waitForEvent('download')
  await page.getByRole('button', { name: /ZIP completo/ }).click()
  const d2 = await dl2
  await d2.saveAs(path.join(OUT, d2.suggestedFilename()))
  log(`Pack "${title}" exportado:`, d1.suggestedFilename(), d2.suggestedFilename())
  await page.getByRole('button', { name: 'Volver a los packs' }).click()
}

await buildPack('Pack estático', 'E2E estatico')
await buildPack('Pack animado', 'E2E animado')
await page.waitForTimeout(500)
await shot('packs')

// Vista móvil
await page.setViewportSize({ width: 390, height: 844 })
await page.getByRole('button', { name: /Editor/ }).first().click()
await page.waitForTimeout(800)
await shot('mobile-editor')

if (errors.length) console.log('Errores de página:\n' + errors.join('\n'))
await browser.close()
console.log(`Listo. Archivos en ${OUT}`)
