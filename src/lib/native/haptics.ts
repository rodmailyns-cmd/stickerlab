import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNative } from './platform'

export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'error'

/** Vibración sutil en acciones clave (solo en el APK; en la web no hace nada). */
export function haptic(kind: HapticKind = 'tap') {
  if (!isNative) return
  const p =
    kind === 'tap'
      ? Haptics.impact({ style: ImpactStyle.Light })
      : kind === 'select'
        ? Haptics.selectionChanged()
        : Haptics.notification({ type: kind === 'success' ? NotificationType.Success : kind === 'warning' ? NotificationType.Warning : NotificationType.Error })
  void p.catch(() => {})
}
