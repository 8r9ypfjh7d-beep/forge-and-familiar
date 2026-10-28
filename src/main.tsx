import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design'
import App from './App.tsx'
import { PwaPrompt, registerServiceWorker } from './pwa'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PwaPrompt />
  </StrictMode>,
)
