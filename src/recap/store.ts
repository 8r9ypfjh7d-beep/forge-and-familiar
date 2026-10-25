// Session store, one list per user. Async like src/storage so a hosted backend can replace
// localStorage later. Changes are read-modify-write on the latest saved list, so two tabs
// recording the same save end up with one copy of its events.
import type { Session } from './types'

const key = (userId: string) => `ff.recaps.v1.${userId}`
const CHANGED = 'ff:recaps-changed'
/** Oldest finished sessions are dropped past this, to stay well inside localStorage limits. */
const MAX_SESSIONS = 50

function read(userId: string): Session[] {
  try {
    const list = JSON.parse(localStorage.getItem(key(userId)) ?? '[]')
    return Array.isArray(list) ? (list as Session[]) : []
  } catch {
    return []
  }
}

function write(userId: string, list: Session[]) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(list.slice(0, MAX_SESSIONS)))
  } catch {
    // Storage full or blocked; the session stays as it was.
  }
  window.dispatchEvent(new Event(CHANGED))
}

/** Newest first. */
export async function listSessions(userId: string): Promise<Session[]> {
  return read(userId)
}

export async function getActiveSession(userId: string): Promise<Session | undefined> {
  return read(userId).find(s => !s.endedAt)
}

export async function saveSession(s: Session): Promise<void> {
  const list = read(s.ownerId).filter(x => x.id !== s.id)
  write(s.ownerId, [s, ...list].sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
}

/** Applies `change` to the latest saved copy. Skips the write when nothing changed. */
export async function updateSession(userId: string, id: string, change: (s: Session) => Session): Promise<Session | undefined> {
  const list = read(userId)
  const i = list.findIndex(s => s.id === id)
  if (i < 0) return undefined
  const next = change(list[i])
  if (next !== list[i]) {
    list[i] = next
    write(userId, list)
  }
  return next
}

export async function deleteSession(userId: string, id: string): Promise<void> {
  write(userId, read(userId).filter(s => s.id !== id))
}

/** Calls fn when any session list changes, in this tab or another one. */
export function onSessionsChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key?.startsWith('ff.recaps.v1.')) fn() }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
  }
}
