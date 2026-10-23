// Genera los iconos PNG de la PWA a partir de public/favicon.svg (usa Chromium de Playwright).
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const svg = fs.readFileSync('public/favicon.svg', 'utf8')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage()
async function render(size, maskable, out) {
  const pad = maskable ? size * 0.12 : 0
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:${maskable ? '#ff9fd0' : 'transparent'}">
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center">
    <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="width:${size - pad * 2}px;height:${size - pad * 2}px"></div></body></html>`)
  await page.screenshot({ path: out, omitBackground: !maskable })
}
fs.mkdirSync('public/icons', { recursive: true })
await render(192, false, 'public/icons/icon-192.png')
await render(512, false, 'public/icons/icon-512.png')
await render(512, true, 'public/icons/icon-maskable-512.png')
await browser.close()
console.log('iconos generados')

// ── Recursos de Android (icono adaptativo y splash) para `npx capacitor-assets generate --android` ──
const face = svg.replace(/<rect[^>]*\/>/, '') // solo la "hoja" con la carita, sin el fondo
const fontCss = fs
  .readFileSync('public/fonts/fredoka.css', 'utf8')
  .replace(/url\(\.\/files\/([^)]+)\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(`public/fonts/files/${f}`).toString('base64')})`)
const b64 = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`
const page2 = await (await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })).newPage()
async function shot(size, html, out, transparent = false) {
  await page2.setViewportSize({ width: size, height: size })
  await page2.setContent(`<html><head><style>${fontCss} body{margin:0}</style></head><body>${html}</body></html>`, { waitUntil: 'load' })
  await page2.evaluate(() => document.fonts.ready)
  await page2.screenshot({ path: out, omitBackground: transparent })
}
fs.mkdirSync('assets', { recursive: true })
const grad = 'linear-gradient(135deg,#ff8fc8,#9b7bff)'
// Primer plano: la carita ocupa la zona segura (≈ 60 % central)
await shot(1024, `<div style="width:1024px;height:1024px;display:grid;place-items:center"><img src="${b64(face)}" style="width:700px"></div>`, 'assets/icon-foreground.png', true)
await shot(1024, `<div style="width:1024px;height:1024px;background:${grad}"></div>`, 'assets/icon-background.png')
await shot(1024, `<img src="${b64(svg)}" style="width:1024px">`, 'assets/icon-only.png', true)
const splash = (bg, ink) => `<div style="width:2732px;height:2732px;background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:70px;font-family:Fredoka">
  <img src="${b64(svg)}" style="width:520px;filter:drop-shadow(0 40px 60px rgba(155,123,255,.35))">
  <div style="font-size:190px;font-weight:700;color:${ink};letter-spacing:-4px">Sticker<span style="background:${grad};-webkit-background-clip:text;color:transparent">Lab</span></div>
  <div style="font-size:84px;font-weight:600;color:${ink};opacity:.55">Crea stickers para WhatsApp</div></div>`
await shot(2732, splash('radial-gradient(circle at 50% 40%,#fff 0,#fff7fb 45%,#ffe6f3 100%)', '#2b2140'), 'assets/splash.png')
await shot(2732, splash('radial-gradient(circle at 50% 40%,#2e2547 0,#1c1630 60%,#151024 100%)', '#fdf6ff'), 'assets/splash-dark.png')
await page2.context().browser().close()
console.log('recursos de Android generados en assets/')
