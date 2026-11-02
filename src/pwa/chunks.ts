// After a deploy, a page opened on the old build may ask for a screen chunk the server no longer has.
// Vite reports that as `vite:preloadError`; reload once to pick up the new build instead of showing a blank screen.
const KEY = 'ff.chunkReload'

export function recoverFromStaleChunks() {
  if (typeof window === 'undefined') return
  window.addEventListener('vite:preloadError', (event) => {
    let last = 0
    try { last = Number(sessionStorage.getItem(KEY) ?? 0) } catch { /* storage blocked */ }
    // At most one reload a minute, so a chunk that is truly missing (offline, never cached) can't loop.
    if (Date.now() - last < 60_000) return
    try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* storage blocked */ }
    event.preventDefault()
    location.reload()
  })
}
