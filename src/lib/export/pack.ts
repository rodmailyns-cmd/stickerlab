import JSZip from 'jszip'
import { safeFileName, sanitizeIdentifier, WA_LIMITS } from './limits'

export interface PackFileSticker {
  name: string
  bytes: Uint8Array
  emojis: string[]
}

export interface PackFiles {
  identifier: string
  name: string
  publisher: string
  animated: boolean
  tray: Uint8Array
  stickers: PackFileSticker[]
  publisherEmail?: string
  publisherWebsite?: string
}

export interface ContentsJson {
  android_play_store_link: string
  ios_app_store_link: string
  sticker_packs: Array<{
    identifier: string
    name: string
    publisher: string
    tray_image_file: string
    image_data_version: string
    avoid_cache: boolean
    publisher_email: string
    publisher_website: string
    privacy_policy_website: string
    license_agreement_website: string
    animated_sticker_pack: boolean
    stickers: Array<{ image_file: string; emojis: string[]; accessibility_text: string }>
  }>
}

export const TRAY_FILE = 'tray.png'

export function stickerFileName(index: number): string {
  return `${String(index + 1).padStart(2, '0')}.webp`
}

/** contents.json en el formato del proyecto oficial de WhatsApp (Android). */
export function buildContentsJson(pack: PackFiles): ContentsJson {
  return {
    android_play_store_link: '',
    ios_app_store_link: '',
    sticker_packs: [
      {
        identifier: sanitizeIdentifier(pack.identifier),
        name: pack.name.slice(0, WA_LIMITS.textFieldMax),
        publisher: pack.publisher.slice(0, WA_LIMITS.textFieldMax),
        tray_image_file: TRAY_FILE,
        image_data_version: '1',
        avoid_cache: false,
        publisher_email: pack.publisherEmail ?? '',
        publisher_website: pack.publisherWebsite ?? '',
        privacy_policy_website: '',
        license_agreement_website: '',
        animated_sticker_pack: pack.animated,
        stickers: pack.stickers.map((s, i) => ({
          image_file: stickerFileName(i),
          emojis: s.emojis.slice(0, WA_LIMITS.emojisPerStickerMax),
          accessibility_text: s.name.slice(0, pack.animated ? 255 : 125),
        })),
      },
    ],
  }
}

/**
 * .wastickers: ZIP que entienden las apps importadoras (p. ej. "Sticker Maker" en Android).
 * Contiene title.txt, author.txt, el icono de bandeja y los .webp.
 */
export async function buildWastickers(pack: PackFiles): Promise<Blob> {
  const zip = new JSZip()
  zip.file('title.txt', pack.name)
  zip.file('author.txt', pack.publisher)
  zip.file(TRAY_FILE, pack.tray)
  pack.stickers.forEach((s, i) => zip.file(stickerFileName(i), s.bytes))
  zip.file('emojis.json', JSON.stringify(Object.fromEntries(pack.stickers.map((s, i) => [stickerFileName(i), s.emojis]))))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'STORE' })
}

export function readmeText(pack: PackFiles): string {
  return `StickerLab — Pack "${pack.name}" de ${pack.publisher}
${pack.stickers.length} stickers ${pack.animated ? 'animados' : 'estáticos'}

Contenido
---------
- ${safeFileName(pack.name, 'pack')}.wastickers  → importar con apps tipo "Sticker Maker" (Android).
- stickers/  → los .webp sueltos (512×512).
- tray.png   → icono de bandeja 96×96.
- whatsapp-assets/  → formato oficial de WhatsApp (contents.json + carpeta
    "${sanitizeIdentifier(pack.identifier)}"), por si lo quieres usar en tu propia app.
También sirve como copia de seguridad: en StickerLab, Packs → Importar pack.

Cómo añadirlo a WhatsApp
------------------------
ANDROID
 Con la app StickerLab (APK): abre el pack y pulsa "Añadir a WhatsApp".
 Sin la app:
 1. Instala una app importadora (por ejemplo "Sticker Maker" de Viko & Co).
 2. Abre el archivo .wastickers con esa app (o impórtalo desde su menú).
 3. Pulsa "Añadir a WhatsApp" y confirma.

IPHONE
 1. WhatsApp para iOS no abre .wastickers directamente.
 2. Usa una app de stickers (p. ej. "Sticker Maker Studio") e importa los .webp
    de la carpeta stickers/ desde la app Archivos, o
 3. Envíate los stickers por WhatsApp Web y añádelos a Favoritos (★).

WHATSAPP WEB / ESCRITORIO
 1. Abre un chat → icono de emoji → Stickers → "Crear" (+).
 2. Sube cada .webp. Al enviarlo, haz clic derecho → "Añadir a favoritos".
`
}

/** ZIP completo: .wastickers + stickers sueltos + carpeta lista para el formato oficial. */
export async function buildFullZip(pack: PackFiles): Promise<Blob> {
  const zip = new JSZip()
  const id = sanitizeIdentifier(pack.identifier)
  const base = safeFileName(pack.name, 'pack')
  zip.file('LEEME.txt', readmeText(pack))
  zip.file(`${base}.wastickers`, await buildWastickers(pack))
  zip.file(TRAY_FILE, pack.tray)
  const stickers = zip.folder('stickers')!
  pack.stickers.forEach((s, i) => stickers.file(stickerFileName(i), s.bytes))
  const assets = zip.folder('whatsapp-assets')!
  assets.file('contents.json', JSON.stringify(buildContentsJson(pack), null, 2))
  const packDir = assets.folder(id)!
  packDir.file(TRAY_FILE, pack.tray)
  pack.stickers.forEach((s, i) => packDir.file(stickerFileName(i), s.bytes))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE' })
}
