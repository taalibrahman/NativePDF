import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 30000000, // 30MB
      },
      manifest: {
        name: 'NativePDF',
        short_name: 'NativePDF',
        description: 'Native on-device PDF processing PWA',
        theme_color: '#ffffff'
      }
    })
  ],
})
