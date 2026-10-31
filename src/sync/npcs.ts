// The DM's NPC sheets (src/npc) in the cloud: this device's sheets for the signed-in account go up,
// the account's sheets from its other devices come down. Owner (and admin) only; players never pull them.
// Conflicts: an edit beats a delete; otherwise the sheet saved last (its updatedAt) wins.
import { applyRemoteNpc, localNpcs } from '../npc/store'
import type { NpcSheet } from '../npc/types'
import { readMeta, updateMeta } from './outbox'
import { MissingTableError, type RemoteStore } from './types'

/** Queues every sheet already on this device for this account, once. */
function firstUpload(ownerId: string) {
  if (readMeta().owners[ownerId]?.npcsInitialized) return
  const sheets = localNpcs(ownerId)
  updateMeta(m => {
    for (const n of sheets) m.npcs[n.id] = { ownerId, synced: m.npcs[n.id]?.synced, dirty: true }
    m.owners[ownerId] = { ...m.owners[ownerId], npcsInitialized: true }
  })
}

const adopt = (npc: NpcSheet | null, id: string, ownerId: string) => {
  try {
    applyRemoteNpc(npc, id)
  } catch {
    return // Unreadable copy: keep ours.
  }
  updateMeta(m => {
    if (npc) m.npcs[id] = { ownerId, synced: npc.updatedAt }
    else delete m.npcs[id]
  })
}

async function pull(remote: RemoteStore, ownerId: string) {
  const since = readMeta().owners[ownerId]?.npcCursor
  const rows = await remote.pullNpcs(ownerId, since)
  let cursor = since
  for (const row of rows) {
    if (!cursor || row.updatedAt > cursor) cursor = row.updatedAt
    const meta = readMeta().npcs[row.id]
    const local = localNpcs(ownerId).find(n => n.id === row.id)
    if (row.deleted) {
      // An edit made here since the last sync beats the delete; the push brings it back.
      if (meta?.dirty && !meta.deleted) continue
      if (local || meta) adopt(null, row.id, ownerId)
      continue
    }
    const npc = row.data
    if (meta?.dirty) {
      // Deleted here, but edited on another device since: the edit wins.
      if (meta.deleted ? npc.updatedAt > (meta.synced ?? '') : !!local && npc.updatedAt > local.updatedAt) adopt(npc, row.id, ownerId)
      continue
    }
    if (!local || npc.updatedAt > local.updatedAt) adopt(npc, row.id, ownerId)
    else if (npc.updatedAt === local.updatedAt) updateMeta(m => { m.npcs[row.id] = { ownerId, synced: npc.updatedAt } })
  }
  updateMeta(m => { m.owners[ownerId] = { ...m.owners[ownerId], npcCursor: cursor } })
}

async function push(remote: RemoteStore, ownerId: string) {
  const dirty = Object.entries(readMeta().npcs).filter(([, n]) => n.ownerId === ownerId && n.dirty)
  for (const [id, meta] of dirty) {
    const local = meta.deleted ? undefined : localNpcs(ownerId).find(n => n.id === id)
    if (!local && !meta.deleted) { updateMeta(m => { delete m.npcs[id] }); continue }
    if (local) await remote.putNpc({ id, ownerId, data: local, deleted: false })
    else await remote.putNpc({ id, ownerId, data: { id, updatedAt: new Date().toISOString() }, deleted: true })
    updateMeta(m => {
      const now = m.npcs[id]
      if (!local) { if (now?.deleted) delete m.npcs[id] }
      else if (now?.deleted) m.npcs[id] = { ...now, synced: local.updatedAt }
      else {
        // Saved again while the push was on its way: leave it dirty for the next pass.
        const current = localNpcs(ownerId).find(n => n.id === id)
        m.npcs[id] = current && current.updatedAt !== local.updatedAt ? { ownerId, synced: local.updatedAt, dirty: true } : { ownerId, synced: local.updatedAt }
      }
    })
  }
}

/** Pull, then push. Skipped quietly (changes stay queued) while the server has no npc_sheets table yet. */
export async function syncNpcs(remote: RemoteStore, ownerId: string): Promise<void> {
  firstUpload(ownerId)
  try {
    await pull(remote, ownerId)
    await push(remote, ownerId)
  } catch (e) {
    if (!(e instanceof MissingTableError)) throw e
  }
}
