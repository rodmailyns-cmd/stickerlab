// Recorrido de funciones del editor en Chromium: GIF, vídeo, dibujo, filtros, texto curvo,
// keyframes, proyecto .stickerlab, copia de seguridad, ayuda y modo oscuro.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = path.resolve('e2e-output')
const SHOTS = path.join(OUT, 'screens')
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
await ctx.addInitScript(() => localStorage.setItem('sl-onboarded', '1'))
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())
const ok = (msg) => console.log('✓', msg)
const shot = (n) => page.screenshot({ path: path.join(SHOTS, `f-${n}.png`) })
const panel = (name) => page.locator('nav[aria-label="Herramientas"]').first().getByRole('button', { name, exact: true }).click()
const layerCount = () => page.locator('aside[aria-label="Capas"] li, aside[aria-label="Capas"] [draggable], aside[aria-label="Capas"] .cursor-grab').count()
async function setRange(locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}
const fileInput = () => page.locator('input[type=file][accept="image/*,video/*"]')

await page.goto(BASE, { waitUntil: 'networkidle' })

// GIF animado
await fileInput().setInputFiles('e2e-fixtures/bola.gif')
await page.getByText('Imagen añadida').first().waitFor()
const timelineVisible = await page.getByLabel('Línea de tiempo').first().isVisible()
ok(`GIF importado; modo animado activado: ${timelineVisible}`)

// Vídeo con recorte
await fileInput().setInputFiles('e2e-fixtures/clip.webm')
const vdialog = page.getByRole('dialog', { name: 'Recortar vídeo' })
await vdialog.waitFor()
await page.waitForTimeout(800)
await shot('video-dialog')
await vdialog.getByRole('button', { name: /Convertir/ }).click()
await page.getByText('Vídeo convertido').first().waitFor({ timeout: 60000 })
ok('Vídeo convertido en capa animada')

// Dibujo a mano alzada
await panel('Dibujo')
await page.getByRole('radio', { name: /Pincel/ }).click()
const canvas = page.locator('[aria-label^="Lienzo del sticker"]')
const box = await canvas.boundingBox()
await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8)
await page.mouse.down()
for (let i = 0; i <= 20; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.03), box.y + box.height * (0.8 - Math.sin(i / 3) * 0.1))
await page.mouse.up()
await page.waitForTimeout(300)
ok(`Trazo dibujado (${await page.getByText(/trazos/).first().innerText()})`)
await page.getByRole('radio', { name: /Mover/ }).click()

// Filtros sobre la capa del GIF
await page.locator('aside[aria-label="Capas"]').getByText('bola').click()
await panel('Filtros')
await page.getByRole('button', { name: 'Pop-art' }).first().click()
ok('Filtro pop-art aplicado')

// Texto curvo con degradado
await panel('Texto')
await page.getByRole('button', { name: 'Añadir texto' }).click()
await setRange(page.getByLabel('Curva'), 60)
await page.getByRole('switch', { name: /Degradado/ }).click()
ok('Texto curvo con degradado')

// Keyframes
await panel('Animar')
await page.getByRole('button', { name: /Añadir keyframe/ }).click()
await page.getByRole('button', { name: /Latido/ }).click()
ok('Keyframe y animación "latido" añadidos')
await page.waitForTimeout(1500)
await shot('editor-features')

// Deshacer / rehacer
await page.keyboard.press('Control+z')
await page.keyboard.press('Control+Shift+z')
ok('Deshacer y rehacer con atajos')

// Guardar proyecto .stickerlab y volver a abrirlo
await page.getByRole('button', { name: 'Más opciones del proyecto' }).click()
const dl = page.waitForEvent('download')
await page.getByRole('menuitem', { name: 'Guardar proyecto editable' }).click()
const proj = await dl
const projPath = path.join(OUT, proj.suggestedFilename())
await proj.saveAs(projPath)
ok(`Proyecto guardado: ${proj.suggestedFilename()} (${(fs.statSync(projPath).size / 1024).toFixed(0)} KB)`)
await page.getByRole('button', { name: 'Más opciones del proyecto' }).click()
await page.getByRole('menuitem', { name: 'Nuevo sticker' }).click()
await page.getByRole('button', { name: 'Más opciones del proyecto' }).click()
const chooser = page.waitForEvent('filechooser')
await page.getByRole('menuitem', { name: /Abrir proyecto/ }).click()
await (await chooser).setFiles(projPath)
await page.getByText('Proyecto abierto').first().waitFor()
const layersAfter = await page.locator('aside[aria-label="Capas"]').getByRole('button', { name: /Ocultar|Mostrar/ }).count()
ok(`Proyecto reabierto con ${layersAfter} capas`)

// Guardar como sticker para la copia de seguridad
await page.getByRole('button', { name: /Guardar/ }).first().click()
await page.getByRole('dialog').getByRole('button', { name: /Guardar sticker/ }).click()
await page.getByText('¡Sticker guardado!').waitFor({ timeout: 180000 })
const savedInfo = await page.getByRole('dialog').locator('span.rounded-full').first().innerText()
ok(`Sticker con GIF + vídeo + dibujo guardado: ${savedInfo}`)
await page.getByRole('dialog').getByRole('button', { name: 'Seguir creando' }).click()

// Copia de seguridad
await page.getByRole('button', { name: /Biblioteca/ }).click()
const dlb = page.waitForEvent('download')
await page.getByRole('button', { name: 'Copia de seguridad' }).click()
const backup = await dlb
const backupPath = path.join(OUT, 'backup.zip')
await backup.saveAs(backupPath)
ok(`Copia de seguridad (${(fs.statSync(backupPath).size / 1024).toFixed(0)} KB)`)
const chooser2 = page.waitForEvent('filechooser')
await page.getByRole('button', { name: 'Restaurar copia' }).click()
await (await chooser2).setFiles(backupPath)
await page.getByText(/Restaurados/).first().waitFor()
ok(await page.getByText(/Restaurados/).first().innerText())

// Importar packs (.wastickers y ZIP completo) generados por scripts/e2e.mjs
await page.getByRole('button', { name: /Packs/ }).first().click()
for (const f of ['E2E_estatico.wastickers', 'E2E_animado-whatsapp.zip']) {
  const file = path.join(OUT, f)
  if (!fs.existsSync(file)) continue
  const ch = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Importar pack' }).click()
  await (await ch).setFiles(file)
  const name = f.includes('animado') ? 'E2E animado' : 'E2E estatico'
  const msg = page.getByText(`Pack "${name}" importado con`).last()
  await msg.waitFor({ timeout: 30000 })
  ok(`${f}: ${await msg.innerText()}`)
  await page.getByText('Todo cumple los requisitos de WhatsApp.').waitFor({ timeout: 30000 })
  ok(`${f}: el pack importado pasa el validador`)
  await page.getByRole('button', { name: 'Volver a los packs' }).click()
}

// Ayuda y modo oscuro
await page.keyboard.press('Shift+?')
await page.getByRole('button', { name: /Ayuda y atajos/ }).click()
await page.waitForTimeout(400)
await shot('help')
await page.keyboard.press('Escape')
await page.getByRole('button', { name: /Tema/ }).click()
await page.getByRole('button', { name: /Tema/ }).click()
await page.getByRole('button', { name: /Editor/ }).first().click()
await page.waitForTimeout(800)
const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
await shot('dark')
ok(`Modo oscuro activo: ${dark}`)

if (errors.length) console.log('Errores de página:\n' + errors.join('\n'))
else ok('Sin errores de JavaScript')
await browser.close()
