import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { isNative } from './platform'

/** Ajustes que solo aplican dentro del APK. Se llama una vez al arrancar. */
export function initNative() {
  if (!isNative) return
  const html = document.documentElement
  html.classList.add('native')

  // Teclado: marca la página para ocultar la barra inferior mientras escribes
  void Keyboard.addListener('keyboardWillShow', () => html.classList.add('keyboard-open'))
  void Keyboard.addListener('keyboardWillHide', () => html.classList.remove('keyboard-open'))

  // Iconos de la barra de estado/navegación según el tema (claro u oscuro)
  const syncBars = () =>
    void SystemBars.setStyle({ style: html.classList.contains('dark') ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
  syncBars()
  new MutationObserver(syncBars).observe(html, { attributes: true, attributeFilter: ['class'] })

  // El splash se oculta cuando la interfaz ya está pintada
  requestAnimationFrame(() => setTimeout(() => void SplashScreen.hide({ fadeOutDuration: 250 }), 150))
}
