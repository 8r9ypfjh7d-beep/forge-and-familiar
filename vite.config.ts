import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { serviceWorker } from './pwa/vite-plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
})
