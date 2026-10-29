import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design'
import App from './App.tsx'
import { PwaPrompt, registerServiceWorker } from './pwa'
import { ShareView, shareCodeFrom } from './share'

registerServiceWorker()

// A read-only share link (#ff-character=…) shows just that sheet, with no account or app around it.
const shareCode = shareCodeFrom(location.hash)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {shareCode ? <ShareView code={shareCode} /> : <><App /><PwaPrompt /></>}
  </StrictMode>,
)
