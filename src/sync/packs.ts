// Homebrew packs in the cloud. The device's library follows the signed-in account to its other
// devices, and party members' packs come down read-only so their characters' homebrew subclasses,
// classes, races, items and feats resolve here (the DM's device included).
// Conflicts: an edit beats a delete; otherwise the pack saved last (its updatedAt) wins.
import { applyPartyPacks, applyRemotePack, localPacks } from '../homebrew/store'
import type { HomebrewPack } from '../homebrew/types'
import { readMeta, updateMeta } from './outbox'
import { MissingTableError, type RemoteStore } from './types'

/** Queues every pack already on this device for this account, once. */
function firstUpload(ownerId: string) {
  if (readMeta().owners[ownerId]?.packsInitialized) return
  const packs = localPacks()
  updateMeta(m => {
    for (const p of packs) m.packs[p.id] = { synced: m.packs[p.id]?.synced, dirty: true }
    m.owners[ownerId] = { ...m.owners[ownerId], packsInitialized: true }
  })
}

const adopt = (pack: HomebrewPack | null, id: string) => {
  try {
    applyRemotePack(pack, id)
  } catch {
    return // Unreadable copy: keep ours.
  }
  updateMeta(m => {
    if (pack) m.packs[id] = { synced: pack.updatedAt }
    else delete m.packs[id]
  })
}

async function pull(remote: RemoteStore, ownerId: string) {
  const since = readMeta().owners[ownerId]?.packCursor
  const rows = await remote.pullPacks(since)
  const party: Parameters<typeof applyPartyPacks>[0] = []
  let cursor = since
  for (const row of rows) {
    if (!cursor || row.updatedAt > cursor) cursor = row.updatedAt
    if (row.ownerId !== ownerId) {
      party.push({ ownerId: row.ownerId, id: row.id, pack: row.deleted ? null : row.data })
      continue
    }
    const meta = readMeta().packs[row.id]
    const local = localPacks().find(p => p.id === row.id)
    if (row.deleted) {
      // An edit made here since the last sync beats the delete; the push brings it back.
      if (meta?.dirty && !meta.deleted) continue
      if (local || meta) adopt(null, row.id)
      continue
    }
    const pack = row.data
    if (meta?.dirty) {
      // Deleted here, but edited on another device since: the edit wins.
      if (meta.deleted ? pack.updatedAt > (meta.synced ?? '') : !!local && pack.updatedAt > local.updatedAt) adopt(pack, row.id)
      continue
    }
    if (!local || pack.updatedAt > local.updatedAt) adopt(pack, row.id)
    else if (pack.updatedAt === local.updatedAt) updateMeta(m => { m.packs[row.id] = { synced: pack.updatedAt } })
  }
  try {
    applyPartyPacks(party)
  } catch {
    // A broken party pack is skipped; the rest of the pass goes on.
  }
  updateMeta(m => { m.owners[ownerId] = { ...m.owners[ownerId], packCursor: cursor } })
}

async function push(remote: RemoteStore, ownerId: string) {
  const dirty = Object.entries(readMeta().packs).filter(([, p]) => p.dirty)
  for (const [id, meta] of dirty) {
    const local = meta.deleted ? undefined : localPacks().find(p => p.id === id)
    if (!local && !meta.deleted) { updateMeta(m => { delete m.packs[id] }); continue }
    if (local) await remote.putPack({ id, ownerId, data: local, deleted: false })
    else await remote.putPack({ id, ownerId, data: { id, updatedAt: new Date().toISOString() }, deleted: true })
    updateMeta(m => {
      const now = m.packs[id]
      if (!local) { if (now?.deleted) delete m.packs[id] }
      else if (now?.deleted) m.packs[id] = { ...now, synced: local.updatedAt }
      else {
        // Saved again while the push was on its way: leave it dirty for the next pass.
        const current = localPacks().find(p => p.id === id)
        m.packs[id] = current && current.updatedAt !== local.updatedAt ? { synced: local.updatedAt, dirty: true } : { synced: local.updatedAt }
      }
    })
  }
}

/** Pull, then push. Skipped quietly (changes stay queued) while the server has no packs table yet. */
export async function syncPacks(remote: RemoteStore, ownerId: string): Promise<void> {
  firstUpload(ownerId)
  try {
    await pull(remote, ownerId)
    await push(remote, ownerId)
  } catch (e) {
    if (!(e instanceof MissingTableError)) throw e
  }
}
