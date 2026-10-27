// Request store: one list per device, the copy every screen reads. With the cloud on, cloud.ts sends
// changes to the dm_requests table and merges answers back; links are the fallback between devices.
import { emptySync, noteLocalChange, type SyncState } from './sync'
import type { DmRequest } from './types'

const KEY = 'ff.requests.v1'
const SYNC_KEY = 'ff.requests.sync.v1'
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

export function readSync(): SyncState {
  try {
    return { ...emptySync(), ...JSON.parse(localStorage.getItem(SYNC_KEY) ?? '{}') }
  } catch {
    return emptySync()
  }
}

export function writeSync(s: SyncState) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(s))
  } catch {
    // Blocked storage; the next pull rebuilds what it can.
  }
}

function write(list: DmRequest[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked; the change lives until reload.
  }
  window.dispatchEvent(new Event(CHANGED))
}

/** Replaces the whole list; callers build it with the pure helpers in logic.ts. Marks what changed for the cloud. */
export async function saveRequests(list: DmRequest[]): Promise<void> {
  writeSync(noteLocalChange(readAll(), list, readSync()))
  write(list)
}

/** cloud.ts only: merges in one synchronous step, so a local save can't slip in between. */
export function mergeFromCloud(fn: (list: DmRequest[], s: SyncState) => { list: DmRequest[]; sync: SyncState }) {
  const before = readAll()
  const { list, sync } = fn(before, readSync())
  writeSync(sync)
  if (JSON.stringify(list) !== JSON.stringify(before)) write(list)
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
