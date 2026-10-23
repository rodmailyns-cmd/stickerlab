// Prueba de la versión móvil/APK en Chromium con un puente nativo simulado (como el de Capacitor en Android).
// Comprueba: botón "Añadir a WhatsApp", copia del pack al almacenamiento de la app, estado "Añadido ✓",
// botón atrás de Android, hoja deslizable, pellizcar para escalar/girar y guardar en la galería.
// Los archivos que la web "escribe en el teléfono" quedan en e2e-output/native/ para validarlos con
// el código Kotlin real:  cd android/jvm-tests && gradle test -Dstickerlab.nativeDir=../../e2e-output/native
// Uso: npm run build && npm run preview (en otra terminal) → npm run e2e:native
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = path.resolve('e2e-output')
const NATIVE = path.join(OUT, 'native')
const SHOTS = path.join(OUT, 'screens')
fs.rmSync(NATIVE, { recursive: true, force: true })
fs.mkdirSync(path.join(NATIVE, 'files'), { recursive: true })
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())
const ok = (m) => console.log('✓', m)
const shot = (n) => page.screenshot({ path: path.join(SHOTS, `native-${n}.png`) })
const calls = []

// "Teléfono" simulado: guarda en disco lo que la web escribe con Filesystem
await page.exposeFunction('__nativeCall', async (plugin, method, options) => {
  calls.push({ plugin, method, options: method === 'writeFile' ? { path: options.path } : options })
  const file = (p) => path.join(NATIVE, 'files', p)
  switch (`${plugin}.${method}`) {
    case 'Filesystem.writeFile':
      fs.mkdirSync(path.dirname(file(options.path)), { recursive: true })
      fs.writeFileSync(file(options.path), Buffer.from(options.data, 'base64'))
      return { uri: `file:///data/user/0/com.stickerlab.app/files/${options.path}` }
    case 'Filesystem.rmdir':
      fs.rmSync(file(options.path), { recursive: true, force: true })
      return {}
    case 'Filesystem.deleteFile':
      fs.rmSync(file(options.path), { force: true })
      return {}
    case 'WhatsAppStickers.getStatus':
      return { installed: true, consumer: true, business: false }
    case 'WhatsAppStickers.savePack': {
      // Lo que recibiría el plugin Kotlin: los metadatos + la carpeta de staging
      const dir = path.join(NATIVE, 'packs', options.pack.identifier)
      fs.rmSync(dir, { recursive: true, force: true })
      fs.cpSync(file(options.stagingDir), dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(options.pack, null, 2))
      return { identifier: options.pack.identifier, name: options.pack.name, publisher: options.pack.publisher, animated: options.pack.animated_sticker_pack, stickerCount: options.pack.stickers.length, imageDataVersion: 1 }
    }
    case 'WhatsAppStickers.isPackAdded':
      return { added: !!globalThis.__added, consumer: !!globalThis.__added, business: false }
    case 'WhatsAppStickers.addToWhatsApp':
      globalThis.__added = true
      return { added: true }
    case 'WhatsAppStickers.saveToDevice':
      fs.mkdirSync(path.join(NATIVE, 'device', options.collection), { recursive: true })
      fs.copyFileSync(file(options.path), path.join(NATIVE, 'device', options.collection, options.fileName))
      return { uri: `content://media/${options.collection}/${options.fileName}` }
    default:
      return {}
  }
})

await ctx.addInitScript(() => {
  localStorage.setItem('sl-onboarded', '1')
  const promise = (name, methods) => ({ name, methods: [...methods.map((m) => ({ name: m, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] })
  const listeners = {}
  window.androidBridge = { postMessage() {} }
  window.Capacitor = {
    PluginHeaders: [
      promise('WhatsAppStickers', ['getStatus', 'savePack', 'listPacks', 'deletePack', 'isPackAdded', 'addToWhatsApp', 'saveToDevice']),
      promise('Filesystem', ['writeFile', 'rmdir', 'deleteFile', 'readFile', 'mkdir']),
      promise('Haptics', ['impact', 'notification', 'selectionChanged', 'vibrate']),
      promise('App', ['minimizeApp', 'exitApp', 'getInfo']),
      promise('Keyboard', ['hide', 'show']),
      promise('SplashScreen', ['hide', 'show']),
      promise('SystemBars', ['setStyle', 'show', 'hide']),
      promise('Share', ['share', 'canShare']),
    ],
    nativePromise: (plugin, method, options) => window.__nativeCall(plugin, method, options ?? {}),
    nativeCallback: (plugin, method, options, cb) => {
      if (method === 'addListener') (listeners[`${plugin}.${options.eventName}`] ??= []).push(cb)
      return `${plugin}-${Math.random()}`
    },
  }
  window.__fire = (key, data) => (listeners[key] ?? []).forEach((cb) => cb(data))
})

await page.goto(BASE, { waitUntil: 'networkidle' })
const native = await page.evaluate(() => document.documentElement.classList.contains('native'))
ok(`Modo APK detectado: ${native}`)
const back = () => page.evaluate(() => window.__fire('App.backButton', { canGoBack: false }))
// Abre una herramienta de la barra inferior (si ya está abierta, pulsarla de nuevo la cerraría)
const tool = async (name) => {
  const btn = page.locator('nav[aria-label="Herramientas"]').getByRole('button', { name, exact: true })
  const sheetOpen = await page.getByRole('button', { name: 'Contraer panel' }).isVisible()
  if (!sheetOpen || (await btn.getAttribute('aria-current')) !== 'true') await btn.click()
  await page.waitForTimeout(350)
}

// Tres stickers animados desde las reacciones rápidas
for (const t of ['JAJAJA', 'Te quiero', 'WOW']) {
  await tool('Plantillas')
  await page.getByRole('button', { name: `Usar ${t}` }).click()
  await page.getByRole('button', { name: /Guardar/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /Guardar sticker|Actualizar sticker/ }).click()
  await dialog.getByText('¡Sticker guardado!').waitFor({ timeout: 180000 })
  ok(`Sticker "${t}": ${(await dialog.locator('span.rounded-full').first().innerText()).trim()}`)
  // Atrás de Android cierra el diálogo
  await back()
  await dialog.waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Más opciones del proyecto' }).click()
  await page.getByRole('menuitem', { name: 'Nuevo sticker' }).click()
}
ok('El botón atrás cierra los diálogos')

// Hoja inferior: atrás la cierra; se puede ampliar
await tool('Texto')
await page.getByRole('button', { name: 'Ampliar panel' }).click()
await page.waitForTimeout(400)
await shot('sheet-tall')
await back()
await page.getByRole('button', { name: 'Contraer panel' }).waitFor({ state: 'detached' })
ok('El botón atrás cierra la hoja inferior')

// Pellizcar con dos dedos: escala y gira la capa seleccionada
await tool('Plantillas')
await page.getByRole('button', { name: 'Usar WOW' }).click()
await back() // cierra la hoja para ver el lienzo entero
await page.waitForTimeout(500)
const canvas = page.locator('[aria-label^="Lienzo del sticker"]')
const box = await canvas.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
await page.mouse.click(cx, cy) // selecciona la capa del centro
const selected = () =>
  page.evaluate(() => {
    const g = window.Konva?.stages?.[0]?.findOne('Transformer')?.nodes()[0]
    return g ? { s: g.scaleX(), r: g.rotation() } : null
  })
const before = await selected()
const cdp = await ctx.newCDPSession(page)
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) })
await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]])
for (let i = 1; i <= 10; i++) {
  const d = 40 + i * 6
  const a = (i * 3 * Math.PI) / 180
  await touch('touchMove', [[cx - d * Math.cos(a), cy - d * Math.sin(a)], [cx + d * Math.cos(a), cy + d * Math.sin(a)]])
}
await touch('touchEnd', [])
await page.waitForTimeout(300)
const after = await selected()
ok(`Pellizcar: escala ${before?.s?.toFixed(2)} → ${after?.s?.toFixed(2)}, giro ${before?.r?.toFixed(0)}° → ${after?.r?.toFixed(0)}°`)
await shot('pinch')

// Pack animado y "Añadir a WhatsApp"
await page.getByRole('button', { name: 'Packs' }).click()
await page.getByRole('button', { name: 'Pack animado' }).click()
await page.getByLabel('Nombre del pack').fill('Reacciones')
await page.getByLabel('Autor').fill('StickerLab')
await page.getByRole('button', { name: 'Guardar nombre y autor' }).click()
await page.getByRole('button', { name: 'Añadir', exact: true }).first().click()
const dialog = page.getByRole('dialog')
for (const b of await dialog.locator('button[aria-pressed]').all()) await b.click()
await dialog.getByRole('button', { name: 'Añadir', exact: true }).click()
await page.getByText('Todo cumple los requisitos de WhatsApp.').waitFor({ timeout: 30000 })
const addBtn = page.getByRole('button', { name: 'Añadir a WhatsApp' })
await addBtn.scrollIntoViewIfNeeded()
await shot('pack-before')
const overflow = await page.evaluate(() =>
  [...document.querySelectorAll('*')]
    .filter((e) => e.scrollLeft > 0 || e.getBoundingClientRect().right > window.innerWidth + 1)
    .slice(0, 6)
    .map((e) => `${e.tagName}.${String(e.className).slice(0, 60)} left=${e.scrollLeft} right=${Math.round(e.getBoundingClientRect().right)}`),
)
ok(`Sin desbordamiento horizontal: ${overflow.length === 0 ? 'sí' : overflow.join(' | ')}`)
await addBtn.click()
await page.getByText('Añadido', { exact: true }).waitFor({ timeout: 30000 })
await shot('pack-added')
const written = calls.filter((c) => c.method === 'writeFile' && c.options.path.startsWith('wa-staging/')).length
ok(`"Añadir a WhatsApp": ${written} archivos copiados a la app, savePack y addToWhatsApp llamados → "Añadido ✓"`)

// Guardar en la galería
await page.getByRole('button', { name: 'A la galería' }).click()
await page.getByText(/stickers guardados en Imágenes/).waitFor()
ok(`Guardados en la galería: ${fs.readdirSync(path.join(NATIVE, 'device', 'pictures')).length} archivos`)

// Atrás: pack → lista de packs → editor
await back()
await page.getByRole('button', { name: 'Pack animado' }).waitFor()
await back()
await page.locator('nav[aria-label="Herramientas"]').waitFor()
ok('El botón atrás vuelve de pack → packs → editor')

if (errors.length) console.log('Errores de página:\n' + errors.join('\n'))
else ok('Sin errores de JavaScript')
await browser.close()
