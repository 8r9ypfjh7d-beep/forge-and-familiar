import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design'
import App from './App.tsx'
import { PwaPrompt, registerServiceWorker } from './pwa'
import { shareCodeFrom } from './share/link'
import { LazyShareView } from './share/lazy'
import { loadCurrentLocale } from './i18n'
import { recoverFromStaleChunks } from './pwa/chunks'

registerServiceWorker()
recoverFromStaleChunks()

// A read-only share link (#ff-character=…) shows just that sheet, with no account or app around it.
const shareCode = shareCodeFrom(location.hash)

// Hebrew text is its own chunk; fetch it first so a Hebrew player never sees an English flash. A failed fetch still renders (in English).
loadCurrentLocale().catch(() => {}).finally(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {shareCode ? <Suspense><LazyShareView code={shareCode} /></Suspense> : <><App /><PwaPrompt /></>}
  </StrictMode>,
))
