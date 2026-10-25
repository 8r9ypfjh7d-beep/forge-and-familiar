// Service worker registration plus the two browser signals the app reacts to: a new version is ready, and the app can be installed.

type Listener = () => void

let waiting: ServiceWorker | null = null
let installEvent: BeforeInstallPromptEvent | null = null
const listeners = new Set<Listener>()
const notify = () => listeners.forEach((l) => l())

/** Chromium's install prompt event. Not in the DOM lib yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function subscribePwa(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const hasUpdate = () => waiting !== null
export const canInstall = () => installEvent !== null

/** Swaps in the waiting service worker, then reloads once it controls the page. */
export function applyUpdate() {
  if (!waiting) return
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
  waiting.postMessage('SKIP_WAITING')
}

/** Shows the browser's install dialog. Returns true when the player accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = installEvent
  if (!event) return false
  installEvent = null
  notify()
  await event.prompt()
  return (await event.userChoice).outcome === 'accepted'
}

function track(worker: ServiceWorker | null) {
  if (!worker) return
  const check = () => {
    // A worker that installs while another controls the page is an update. The very first install is not.
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      waiting = worker
      notify()
    }
  }
  check()
  worker.addEventListener('statechange', check)
}

export function registerServiceWorker() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    notify()
  })

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      track(reg.waiting)
      reg.addEventListener('updatefound', () => track(reg.installing))
      // Long sessions at the table still hear about new versions.
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    } catch (err) {
      console.warn('Service worker registration failed', err)
    }
  })
}
