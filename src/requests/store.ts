// Request store: one list per device. Async like src/storage so a hosted backend can replace
// localStorage later. Until then a request reaches a DM on another device through a link (share.ts).
import type { DmRequest } from './types'

const KEY = 'ff.requests.v1'
const CHANGED = 'ff:requests-changed'

function readAll(): DmRequest[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? (list as DmRequest[]) : []
  } catch {
    return []
  }
}

export async function listRequests(): Promise<DmRequest[]> {
  return readAll()
}

/** Replaces the whole list; callers build it with the pure helpers in logic.ts. */
export async function saveRequests(list: DmRequest[]): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked; the change lives until reload.
  }
  window.dispatchEvent(new Event(CHANGED))
}

/** Reads, changes and saves the list in one step. */
export async function updateRequests(fn: (list: DmRequest[]) => DmRequest[]): Promise<DmRequest[]> {
  const next = fn(readAll())
  await saveRequests(next)
  return next
}

/** Fires on changes in this tab and in other tabs of the same browser. */
export function onRequestsChanged(fn: () => void): () => void {
  const storage = (e: StorageEvent) => { if (e.key === KEY) fn() }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', storage)
  }
}
