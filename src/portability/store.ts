// Snapshot store. Async like src/storage so a hosted backend can replace localStorage later.
import type { Snapshot } from './snapshots'

const KEY = 'ff.snapshots.v1'
/** Oldest snapshots are dropped past this, per character. */
export const MAX_SNAPSHOTS = 30

type Store = Record<string, Snapshot[]>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return typeof parsed === 'object' && parsed !== null ? (parsed as Store) : {}
  } catch {
    return {}
  }
}

/** Throws when storage is full, so the caller can tell the player. */
function write(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store))
}

/** Newest first. */
export async function listSnapshots(characterId: string): Promise<Snapshot[]> {
  return [...(read()[characterId] ?? [])].sort((a, b) => b.takenAt.localeCompare(a.takenAt))
}

export async function addSnapshots(snaps: Snapshot[]): Promise<void> {
  const store = read()
  for (const s of snaps) store[s.characterId] = [...(store[s.characterId] ?? []), s]
  for (const id of new Set(snaps.map(s => s.characterId))) {
    store[id] = store[id].sort((a, b) => a.takenAt.localeCompare(b.takenAt)).slice(-MAX_SNAPSHOTS)
  }
  write(store)
}

export async function deleteSnapshot(characterId: string, snapshotId: string): Promise<void> {
  const store = read()
  store[characterId] = (store[characterId] ?? []).filter(s => s.id !== snapshotId)
  write(store)
}

export async function deleteSnapshotsFor(characterId: string): Promise<void> {
  const store = read()
  delete store[characterId]
  write(store)
}
