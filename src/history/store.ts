// Revision store. Async like src/storage so a hosted backend can replace localStorage later.
import { isRevision, MAX_REVISIONS, mergeRevisions, nextRevision, SHARED_REVISIONS } from './revisions'
import type { RecordInput, Revision } from './types'

const KEY = 'ff.history.v1'
const CHANGED = 'ff:history-changed'

/** entryId -> revisions, oldest first. */
type Store = Record<string, Revision[]>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Store) : {}
  } catch {
    return {}
  }
}

/** Throws when storage is full, so the caller can tell the player. */
function write(store: Store, changedIds: string[]) {
  localStorage.setItem(KEY, JSON.stringify(store))
  window.dispatchEvent(new CustomEvent<string[]>(CHANGED, { detail: changedIds }))
}

/** Newest first. */
export async function listRevisions(entryId: string): Promise<Revision[]> {
  return [...(read()[entryId] ?? [])].sort((a, b) => b.rev - a.rev)
}

/**
 * Records a version of an entry after it is saved or imported. Returns the new revision,
 * or null when nothing changed since the latest one.
 */
export async function recordRevision<E extends { id: string }>(input: RecordInput<E>): Promise<Revision | null> {
  const store = read()
  const list = store[input.entry.id] ?? []
  const rev = nextRevision(list, input)
  if (!rev) return null
  store[rev.entryId] = [...list, rev].slice(-MAX_REVISIONS)
  write(store, [rev.entryId])
  return rev
}

/** Recent history for the given entries, to embed in a shared pack file. */
export async function historyForSharing(entryIds: string[]): Promise<Revision[]> {
  const store = read()
  return entryIds.flatMap(id => (store[id] ?? []).slice(-SHARED_REVISIONS))
}

/** Merges history that arrived inside a shared pack. Unknown or broken rows are ignored. */
export async function importHistory(revisions: unknown): Promise<void> {
  if (!Array.isArray(revisions)) return
  const byEntry = new Map<string, Revision[]>()
  for (const r of revisions.filter(isRevision)) byEntry.set(r.entryId, [...(byEntry.get(r.entryId) ?? []), r])
  if (byEntry.size === 0) return
  const store = read()
  for (const [id, incoming] of byEntry) store[id] = mergeRevisions(store[id] ?? [], incoming)
  write(store, [...byEntry.keys()])
}

/** Drops history for entries whose id starts with `prefix`, e.g. `hb:<packId>:` when a pack is deleted. */
export async function deleteHistory(prefix: string): Promise<void> {
  const store = read()
  const gone = Object.keys(store).filter(id => id.startsWith(prefix))
  if (gone.length === 0) return
  for (const id of gone) delete store[id]
  write(store, gone)
}

/** Calls fn with the changed entry ids (empty from another tab). Returns an unsubscribe function. */
export function onHistoryChanged(fn: (entryIds: string[]) => void): () => void {
  const here = (e: Event) => fn((e as CustomEvent<string[]>).detail ?? [])
  const other = (e: StorageEvent) => { if (e.key === KEY) fn([]) }
  window.addEventListener(CHANGED, here)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, here)
    window.removeEventListener('storage', other)
  }
}
