import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/thames-paddle/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Thames Paddle',
        short_name: 'Thames Paddle',
        description: 'Plan and track kayaking trips on the Thames — Lechlade to Henley',
        theme_color: '#1a6b4a',
        background_color: '#f5f5f0',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/thames-paddle/',
        start_url: '/thames-paddle/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Cache app shell and static assets
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Runtime caching for map tiles and API data
        runtimeCaching: [
          {
            // OpenStreetMap tiles — cache first, with 7-day expiry
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 2000,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // EA flood monitoring API — network first, fall back to cache
            urlPattern: /^https:\/\/environment\.data\.gov\.uk\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ea-api',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            // Open-Meteo weather API — network first, fall back to cache
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 30 * 60 // 30 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      }
    })
  ],
})
