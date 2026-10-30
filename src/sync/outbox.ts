// Sync bookkeeping in localStorage (ff.sync.v1): the server revision each character was last
// synced at, local changes waiting to be pushed (characters, snapshots, homebrew packs), and pull
// cursors per account.
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

/** A homebrew pack in this device's library. Packs belong to the device, not one account. */
export interface PackMeta {
  /** The pack's updatedAt when it was last on the server. */
  synced?: string
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
  /** Set after this device's packs were first queued for this account. */
  packsInitialized?: true
  packCursor?: string
}

interface Meta {
  chars: Record<string, CharMeta>
  snaps: Record<string, SnapMeta>
  packs: Record<string, PackMeta>
  owners: Record<string, OwnerMeta>
}

export function readMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY)
    const m = raw ? (JSON.parse(raw) as Partial<Meta>) : {}
    return { chars: m.chars ?? {}, snaps: m.snaps ?? {}, packs: m.packs ?? {}, owners: m.owners ?? {} }
  } catch {
    return { chars: {}, snaps: {}, packs: {}, owners: {} }
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

/** Called by the homebrew store when a pack is saved, imported or deleted on this device. */
export function markPackDirty(id: string, deleted = false) {
  updateMeta(m => {
    const synced = m.packs[id]?.synced
    m.packs[id] = deleted ? { synced, dirty: true, deleted: true } : { synced, dirty: true }
  }, true)
}

/** Local changes not yet pushed for this account. */
export function pendingCount(ownerId: string): number {
  const m = readMeta()
  const count = (r: Record<string, { ownerId: string; dirty?: true }>) =>
    Object.values(r).filter(x => x.ownerId === ownerId && x.dirty).length
  return count(m.chars) + count(m.snaps) + Object.values(m.packs).filter(p => p.dirty).length
}
