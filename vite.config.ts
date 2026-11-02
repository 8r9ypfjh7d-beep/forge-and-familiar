import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { serviceWorker } from './pwa/vite-plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
  // Hebrew loads on demand in the app; tests translate synchronously, so it is registered up front.
  test: { setupFiles: ['src/i18n/test-setup.ts'] },
})
