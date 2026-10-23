import { Apple, Monitor, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { Segmented } from '@/components/ui/Controls'
import { isNative } from '@/lib/native/platform'

type Platform = 'app' | 'android' | 'iphone' | 'web'

const GUIDES: Record<Platform, { steps: string[]; note?: string }> = {
  app: {
    steps: [
      'Crea un pack con entre 3 y 30 stickers (todos estáticos o todos animados).',
      'Corrige lo que marque el validador (el botón “Corregir automáticamente” lo hace por ti).',
      'Pulsa “Añadir a WhatsApp” y confirma en la ventana de WhatsApp.',
      'Listo: el pack aparece en la pestaña de stickers y aquí verás “Añadido ✓”. Si cambias el pack, pulsa “Actualizar en WhatsApp”.',
    ],
    note: 'Funciona con WhatsApp y WhatsApp Business. No borres StickerLab: WhatsApp lee los stickers desde la app.',
  },
  android: {
    steps: [
      'Crea un pack con entre 3 y 30 stickers (todos estáticos o todos animados).',
      'Lo más fácil: instala el APK de StickerLab en el teléfono y usa el botón “Añadir a WhatsApp”.',
      'Sin el APK: pulsa “Exportar .wastickers” o “Compartir” para enviarlo a tu móvil e instala una app importadora gratuita, por ejemplo “Sticker Maker” (Viko & Co.) o “Personal Stickers for WhatsApp”.',
      'Abre el archivo .wastickers con esa app (o impórtalo desde su menú).',
      'Pulsa “Añadir a WhatsApp” y confirma. ¡Ya aparece en tu pestaña de stickers!',
    ],
  },
  iphone: {
    steps: [
      'Descarga el ZIP del pack o los .webp sueltos y guárdalos en la app Archivos.',
      'Instala una app de stickers para iOS que importe imágenes (p. ej. “Sticker Maker Studio” o “Sticky AI”).',
      'Crea un pack en esa app, añade los .webp (o las imágenes) y pulsa “Añadir a WhatsApp”.',
      'Alternativa rápida: envía los stickers desde WhatsApp Web a un chat y, en el iPhone, mantén pulsado cada sticker → “Añadir a favoritos”.',
    ],
    note: 'WhatsApp para iPhone no abre archivos .wastickers directamente; por eso hace falta una app intermedia.',
  },
  web: {
    steps: [
      'Abre web.whatsapp.com o la app de escritorio y entra en cualquier chat.',
      'Pulsa el icono de emoji → pestaña Stickers → “Crear” (+).',
      'Sube el .webp descargado desde StickerLab y envíalo.',
      'Haz clic derecho (o mantén pulsado en el móvil) sobre el sticker enviado → “Añadir a favoritos”. Aparecerá en todos tus dispositivos.',
    ],
  },
}

export function WhatsAppGuide() {
  const [p, setP] = useState<Platform>(isNative ? 'app' : 'android')
  const g = GUIDES[p]
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Plataforma"
        value={p}
        onChange={setP}
        options={[
          ...(isNative ? [{ value: 'app' as const, label: <><Smartphone className="size-4" /> Esta app</> }] : []),
          { value: 'android', label: <><Smartphone className="size-4" /> Android</> },
          { value: 'iphone', label: <><Apple className="size-4" /> iPhone</> },
          { value: 'web', label: <><Monitor className="size-4" /> Web</> },
        ]}
      />
      <ol className="flex flex-col gap-2">
        {g.steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-xs font-black text-white">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      {g.note && <p className="rounded-2xl border-2 border-dashed border-line p-3 text-xs text-muted">{g.note}</p>}
    </div>
  )
}
