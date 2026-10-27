// Sync bookkeeping in localStorage (ff.sync.v1): the server revision each character was last
// synced at, local changes waiting to be pushed, and pull cursors per account.
// No imports from the stores, so they can call it without a cycle.

const KEY = 'ff.sync.v1'
export const OUTBOX_CHANGED = 'ff:outbox-changed'

export interface CharMeta {
  ownerId: string
  /** Server revision of the copy on this device; 0 = never on the server. */
  rev: number
  dirty?: true
  deleted?: true
}

export interface SnapMeta {
  ownerId: string
  dirty?: true
  deleted?: true
}

export interface OwnerMeta {
  /** Set after the first full sync: everything made before it has been uploaded. */
  initialized?: true
  charCursor?: string
  snapCursor?: string
  /** Rolls newer than this still need pushing. */
  rollsPushedAt?: string
}

interface Meta {
  chars: Record<string, CharMeta>
  snaps: Record<string, SnapMeta>
  owners: Record<string, OwnerMeta>
}

export function readMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY)
    const m = raw ? (JSON.parse(raw) as Partial<Meta>) : {}
    return { chars: m.chars ?? {}, snaps: m.snaps ?? {}, owners: m.owners ?? {} }
  } catch {
    return { chars: {}, snaps: {}, owners: {} }
  }
}

function writeMeta(m: Meta, notify: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    // Storage full: the next save marks it again.
  }
  if (notify) globalThis.window?.dispatchEvent(new Event(OUTBOX_CHANGED))
}

export function updateMeta(fn: (m: Meta) => void, notify = false) {
  const m = readMeta()
  fn(m)
  writeMeta(m, notify)
}

/** Called by storage on every local save. */
export function markCharacterDirty(id: string, ownerId: string) {
  updateMeta(m => {
    m.chars[id] = { ownerId, rev: m.chars[id]?.rev ?? 0, dirty: true }
  }, true)
}

/** Called by storage on a local delete. Characters never on the server are just forgotten. */
export function markCharacterDeleted(id: string, ownerId: string) {
  updateMeta(m => {
    const rev = m.chars[id]?.rev ?? 0
    if (rev === 0) delete m.chars[id]
    else m.chars[id] = { ownerId, rev, dirty: true, deleted: true }
  }, true)
}

export function markSnapshotDirty(id: string, ownerId: string, deleted = false) {
  updateMeta(m => {
    m.snaps[id] = deleted ? { ownerId, dirty: true, deleted: true } : { ownerId, dirty: true }
  }, true)
}

/** Local changes not yet pushed for this account. */
export function pendingCount(ownerId: string): number {
  const m = readMeta()
  const count = (r: Record<string, { ownerId: string; dirty?: true }>) =>
    Object.values(r).filter(x => x.ownerId === ownerId && x.dirty).length
  return count(m.chars) + count(m.snaps)
}
