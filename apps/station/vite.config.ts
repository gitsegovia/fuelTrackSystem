import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Habilitado en dev para poder probar el SW sin necesidad de build
      devOptions: { enabled: false },
      manifest: {
        name: 'FuelTrack Station',
        short_name: 'FuelTrack',
        description: 'Panel operacional para estaciones de servicio',
        theme_color: '#f59e0b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cachea todos los assets del build (JS, CSS, HTML, fonts, imágenes)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Las requests GraphQL van siempre a la red.
            // El offline lo maneja Apollo (offlineLink + cache persistence).
            urlPattern: /\/graphql$/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
