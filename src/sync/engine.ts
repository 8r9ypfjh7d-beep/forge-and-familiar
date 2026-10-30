// One sync pass for one account: push local changes, pull other devices' changes, resolve
// conflicts (homebrew packs in packs.ts). The first pass on a device uploads everything already saved here.
import type { Character } from '../model/character'
import { applyRemoteCharacter, getCharacter, listCharacters, removeRemoteCharacter } from '../storage'
import { addSnapshots, applyRemoteSnapshots, snapshotsFor } from '../portability/store'
import { BUILD_FIELDS, takeSnapshot, type Snapshot } from '../portability/snapshots'
import { localHistoryStorage } from '../dice/history'
import { migrateSubclassIds } from '../rules/subclass'
import type { RollResult } from '../dice/types'
import { readMeta, updateMeta } from './outbox'
import { syncPacks } from './packs'
import type { RemoteRow, RemoteStore } from './types'

export const ROLLS_SYNCED = 'ff:rolls-synced'
const ROLL_LIMIT = 100
/** Label of the snapshot that keeps the losing side of a conflict. */
export const CONFLICT_LABEL = 'Before sync (other device)'

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** True when two copies differ in more than play state, notes or gear. Both are compared after load migrations, so an old copy's renamed ids don't count. */
export const buildDiffers = (a: Character, b: Character) => {
  const [x, y] = [migrateSubclassIds(a), migrateSubclassIds(b)]
  return BUILD_FIELDS.some(k => !same(x[k], y[k]))
}

/**
 * Picks the copy to keep when both sides changed. Edits beat deletes; otherwise the copy
 * saved last wins. The loser is kept as a snapshot when its build differs, so a level-up
 * made on the other device can be rolled back to.
 */
export function resolveConflict(local: Character | undefined, server: RemoteRow<Character>):
  { keep: 'local' | 'server'; rescue?: Character } {
  if (!local) return { keep: 'server' }
  if (server.deleted) return { keep: 'local' }
  const keep = local.updatedAt > server.data.updatedAt ? 'local' : 'server'
  const loser = keep === 'local' ? server.data : local
  const winner = keep === 'local' ? local : server.data
  return buildDiffers(loser, winner) ? { keep, rescue: loser } : { keep }
}

async function rescue(c: Character) {
  try {
    await addSnapshots([takeSnapshot(c, CONFLICT_LABEL)])
  } catch {
    // Storage full: the newer copy still wins.
  }
}

/** Server row → this device, remembering the revision. */
function adopt(row: RemoteRow<Character>) {
  if (row.deleted) {
    removeRemoteCharacter(row.id)
    applyRemoteSnapshots([], snapshotsFor([row.id]).map(s => ({ id: s.id, characterId: s.characterId })))
    updateMeta(m => { delete m.chars[row.id] })
  } else {
    applyRemoteCharacter(row.data)
    updateMeta(m => { m.chars[row.id] = { ownerId: row.ownerId, rev: row.rev } })
  }
}

async function pushCharacters(remote: RemoteStore, ownerId: string) {
  const dirty = Object.entries(readMeta().chars).filter(([, c]) => c.ownerId === ownerId && c.dirty)
  for (const [id, meta] of dirty) {
    let rev = meta.rev
    for (let attempt = 0; attempt < 3; attempt++) {
      const local = meta.deleted ? undefined : await getCharacter(id)
      if (!local && !meta.deleted) { updateMeta(m => { delete m.chars[id] }); break }
      const result = await remote.pushCharacter({ id, ownerId, data: local ?? null, deleted: !local }, rev)
      if (result.ok) {
        const current = local && (await getCharacter(id))
        updateMeta(m => {
          const now = m.chars[id]
          if (!local) delete m.chars[id]
          else if (now?.deleted) m.chars[id] = { ...now, rev: result.rev }
          else if (current && current.updatedAt !== local.updatedAt) m.chars[id] = { ownerId, rev: result.rev, dirty: true }
          else m.chars[id] = { ownerId, rev: result.rev }
        })
        break
      }
      const decision = resolveConflict(local, result.server)
      if (decision.rescue) await rescue(decision.rescue)
      if (decision.keep === 'server') { adopt(result.server); break }
      rev = result.server.rev
    }
  }
}

async function pullCharacters(remote: RemoteStore, ownerId: string) {
  const since = readMeta().owners[ownerId]?.charCursor
  const rows = await remote.pullCharacters(ownerId, since)
  let cursor = since
  for (const row of rows) {
    if (!cursor || row.updatedAt > cursor) cursor = row.updatedAt
    const meta = readMeta().chars[row.id]
    if (meta && row.rev <= meta.rev) continue
    if (meta?.dirty) {
      // Changed here and there since the last sync: next push resolves it.
      continue
    }
    adopt(row)
  }
  updateMeta(m => { m.owners[ownerId] = { ...m.owners[ownerId], charCursor: cursor } })
}

async function syncSnapshots(remote: RemoteStore, ownerId: string) {
  const dirty = Object.entries(readMeta().snaps).filter(([, s]) => s.ownerId === ownerId && s.dirty)
  if (dirty.length) {
    const ids = (await listCharacters(ownerId)).map(c => c.id)
    const local = new Map(snapshotsFor(ids).map(s => [s.id, s]))
    for (const [id, meta] of dirty) {
      const snap = local.get(id)
      if (snap) await remote.putSnapshot({ id, ownerId, data: snap, deleted: !!meta.deleted })
      else if (meta.deleted) await remote.putSnapshot({ id, ownerId, data: { id } as Snapshot, deleted: true })
      updateMeta(m => { delete m.snaps[id] })
    }
  }
  const since = readMeta().owners[ownerId]?.snapCursor
  const rows = await remote.pullSnapshots(ownerId, since)
  const known = new Set((await listCharacters(ownerId)).map(c => c.id))
  const pending = readMeta().snaps
  const put: Snapshot[] = []
  const removed: { id: string; characterId: string }[] = []
  let cursor = since
  for (const row of rows) {
    if (!cursor || row.updatedAt > cursor) cursor = row.updatedAt
    if (pending[row.id]?.dirty) continue
    if (row.deleted) { if (row.data.characterId) removed.push({ id: row.id, characterId: row.data.characterId }) }
    else if (known.has(row.data.characterId)) put.push(row.data)
  }
  if (put.length || removed.length) applyRemoteSnapshots(put, removed)
  updateMeta(m => { m.owners[ownerId] = { ...m.owners[ownerId], snapCursor: cursor } })
}

async function syncRolls(remote: RemoteStore, ownerId: string) {
  const store = localHistoryStorage(`ff.rolls.v1.${ownerId}`)
  const local = store.load() ?? []
  const pushedAt = readMeta().owners[ownerId]?.rollsPushedAt ?? ''
  const fresh = local.filter(r => r.timestamp > pushedAt)
  if (fresh.length) {
    await remote.pushRolls(ownerId, fresh)
    const newest = fresh.reduce((t, r) => (r.timestamp > t ? r.timestamp : t), pushedAt)
    updateMeta(m => { m.owners[ownerId] = { ...m.owners[ownerId], rollsPushedAt: newest } })
  }
  const server = await remote.recentRolls(ownerId, ROLL_LIMIT)
  const merged = mergeRolls(store.load() ?? [], server, ROLL_LIMIT)
  if (!same(merged.map(r => r.id), (store.load() ?? []).map(r => r.id))) {
    store.save(merged)
    globalThis.window?.dispatchEvent(new CustomEvent<string>(ROLLS_SYNCED, { detail: ownerId }))
  }
}

/** Union by id, newest first, capped. */
export function mergeRolls(a: readonly RollResult[], b: readonly RollResult[], limit: number): RollResult[] {
  const byId = new Map<string, RollResult>()
  for (const r of [...a, ...b]) if (!byId.has(r.id)) byId.set(r.id, r)
  return [...byId.values()].sort((x, y) => y.timestamp.localeCompare(x.timestamp)).slice(0, limit)
}

/** Queues everything this account already has on this device, once. */
async function firstUpload(ownerId: string) {
  if (readMeta().owners[ownerId]?.initialized) return
  const chars = await listCharacters(ownerId)
  const snaps = snapshotsFor(chars.map(c => c.id))
  updateMeta(m => {
    for (const c of chars) m.chars[c.id] = { ownerId, rev: m.chars[c.id]?.rev ?? 0, dirty: true }
    for (const s of snaps) m.snaps[s.id] = { ownerId, dirty: true }
    m.owners[ownerId] = { ...m.owners[ownerId] }
  })
}

/** One full pass. Throws on network errors; the outbox keeps everything for the next try. */
export async function syncOnce(remote: RemoteStore, ownerId: string): Promise<void> {
  await firstUpload(ownerId)
  await pushCharacters(remote, ownerId)
  await pullCharacters(remote, ownerId)
  await syncSnapshots(remote, ownerId)
  await syncRolls(remote, ownerId)
  await syncPacks(remote, ownerId)
  updateMeta(m => { m.owners[ownerId] = { ...m.owners[ownerId], initialized: true } })
}
