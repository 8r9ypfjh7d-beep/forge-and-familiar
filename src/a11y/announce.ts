// One polite live region for the whole app, so screen readers hear what a click did.

let region: HTMLElement | null = null

function ensureRegion() {
  if (region?.isConnected) return region
  region = document.createElement('div')
  region.className = 'a11y-sr-only'
  region.setAttribute('role', 'status')
  region.setAttribute('aria-live', 'polite')
  region.setAttribute('aria-atomic', 'true')
  document.body.appendChild(region)
  return region
}

/** Reads `message` out on screen readers. Safe to call from any screen; does nothing outside a browser. */
export function announce(message: string) {
  if (typeof document === 'undefined' || !message) return
  const el = ensureRegion()
  // Clear first so the same message twice in a row is still read.
  el.textContent = ''
  setTimeout(() => { el.textContent = message }, 50)
}
