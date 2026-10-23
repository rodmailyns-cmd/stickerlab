import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.stickerlab.app',
  appName: 'StickerLab',
  webDir: 'dist',
  android: {
    // Imprescindible para WebAssembly (codificar WebP y quitar fondos) en móviles de gama media
    minWebViewVersion: 91,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: false,
      backgroundColor: '#fff7fb',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    Keyboard: { resize: 'native', resizeOnFullScreen: true },
    // Pantalla de borde a borde: la web recibe --safe-area-inset-* y se ajusta a la muesca y la barra de navegación
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'DEFAULT' },
  },
}

export default config
