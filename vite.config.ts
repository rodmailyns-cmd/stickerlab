/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'StickerLab — Crea stickers para WhatsApp',
        short_name: 'StickerLab',
        description: 'Crea stickers estáticos y animados y expórtalos a WhatsApp. Todo en tu navegador.',
        lang: 'es',
        theme_color: '#ff7eb6',
        background_color: '#fff7fb',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // El modelo de IA para quitar fondos (≈60 MB) se guarda en caché la primera vez que se usa.
        // En el APK va dentro de la app y no hace falta.
        globIgnores: ['imgly/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/imgly/'),
            handler: 'CacheFirst',
            options: { cacheName: 'bg-removal-model', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['@jsquash/webp', '@imgly/background-removal'],
  },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
