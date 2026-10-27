// Keeps the signed-in account in sync: on start, shortly after every local change, when the
// connection comes back, when the app is reopened, when another device writes (realtime)
// and every 30 s while it is open.
import { OUTBOX_CHANGED, pendingCount } from './outbox'
import { syncOnce } from './engine'
import type { RemoteStore, SyncStatus } from './types'

const DEBOUNCE_MS = 1500
const POLL_MS = 30_000

let status: SyncStatus = { state: 'off', pending: 0 }
const listeners = new Set<() => void>()

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next }
  listeners.forEach(fn => fn())
}

export const getSyncStatus = (): SyncStatus => status

export function onSyncStatus(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const isOffline = () => globalThis.navigator?.onLine === false

/** Starts syncing `ownerId` with `remote`. Returns a stop function; call it on sign-out. */
export function startSync(remote: RemoteStore, ownerId: string): () => void {
  let running = false
  let again = false
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const run = async () => {
    if (stopped) return
    if (running) { again = true; return }
    if (isOffline()) { setStatus({ state: 'offline', pending: pendingCount(ownerId) }); return }
    running = true
    setStatus({ state: 'syncing', pending: pendingCount(ownerId) })
    try {
      await syncOnce(remote, ownerId)
      if (!stopped) setStatus({ state: 'idle', pending: pendingCount(ownerId), lastSyncedAt: new Date().toISOString(), error: undefined })
    } catch (e) {
      if (!stopped) {
        setStatus({
          state: isOffline() || e instanceof TypeError ? 'offline' : 'error',
          pending: pendingCount(ownerId),
          error: e instanceof Error ? e.message : String(e),
        })
      }
    } finally {
      running = false
      if (again && !stopped) { again = false; void run() }
    }
  }

  const soon = () => {
    setStatus({ pending: pendingCount(ownerId) })
    clearTimeout(timer)
    timer = setTimeout(run, DEBOUNCE_MS)
  }
  const visible = () => { if (document.visibilityState === 'visible') void run() }

  window.addEventListener(OUTBOX_CHANGED, soon)
  window.addEventListener('online', run)
  document.addEventListener('visibilitychange', visible)
  const unsubscribe = remote.subscribe?.(ownerId, soon)
  const poll = setInterval(() => { if (document.visibilityState !== 'hidden') void run() }, POLL_MS)
  void run()

  return () => {
    stopped = true
    clearTimeout(timer)
    clearInterval(poll)
    unsubscribe?.()
    window.removeEventListener(OUTBOX_CHANGED, soon)
    window.removeEventListener('online', run)
    document.removeEventListener('visibilitychange', visible)
    setStatus({ state: 'off', pending: 0, error: undefined })
  }
}
