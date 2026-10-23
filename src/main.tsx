import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initNative } from './lib/native/init'
import { isNative } from './lib/native/platform'

initNative()
// En el APK los archivos ya están dentro de la app: el service worker (PWA) solo hace falta en la web
if (!isNative) void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
