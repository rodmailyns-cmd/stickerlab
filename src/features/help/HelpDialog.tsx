import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Controls'
import { useUi } from '@/store/ui'
import { WhatsAppGuide } from './WhatsAppGuide'

const SHORTCUTS: [string, string][] = [
  ['Ctrl + Z', 'Deshacer'],
  ['Ctrl + Shift + Z  /  Ctrl + Y', 'Rehacer'],
  ['Ctrl + S', 'Guardar sticker'],
  ['Ctrl + V', 'Pegar imagen'],
  ['Ctrl + D', 'Duplicar selección'],
  ['Ctrl + G  /  Ctrl + Shift + G', 'Agrupar / desagrupar'],
  ['Ctrl + A', 'Seleccionar todo'],
  ['Supr  /  Retroceso', 'Eliminar selección'],
  ['Flechas (Shift = 10 px)', 'Mover selección'],
  ['[  /  ]', 'Enviar atrás / traer adelante'],
  ['Espacio', 'Reproducir / pausar animación'],
  ['V', 'Herramienta mover'],
  ['B  /  E', 'Pincel / borrador'],
  ['T', 'Añadir texto'],
  ['Esc', 'Deseleccionar'],
  ['Shift + clic', 'Selección múltiple'],
  ['?', 'Abrir esta ayuda'],
]

export function HelpDialog() {
  const open = useUi((s) => s.helpOpen)
  const setOpen = useUi((s) => s.setHelpOpen)
  const restart = useUi((s) => s.restartOnboarding)
  const [tab, setTab] = useState<'keys' | 'wa'>('keys')
  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Ayuda"
      size="lg"
      footer={
        <Button variant="ghost" icon={RotateCcw} onClick={() => { setOpen(false); restart() }}>
          Ver la bienvenida otra vez
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented label="Sección de ayuda" value={tab} onChange={setTab} options={[{ value: 'keys', label: 'Atajos de teclado' }, { value: 'wa', label: 'Añadir a WhatsApp' }]} />
        {tab === 'keys' ? (
          <table className="w-full text-sm">
            <caption className="sr-only">Atajos de teclado</caption>
            <tbody>
              {SHORTCUTS.map(([k, v]) => (
                <tr key={k} className="border-b-2 border-line last:border-0">
                  <td className="py-2 pr-3">
                    <kbd className="rounded-lg bg-surface-3 px-2 py-1 font-mono text-xs font-bold">{k}</kbd>
                  </td>
                  <td className="py-2 font-semibold">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <WhatsAppGuide />
        )}
      </div>
    </Modal>
  )
}
