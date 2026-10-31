// NPC sheet store. Async like src/storage; localStorage on the device, synced to the DM's account by
// src/sync/npcs.ts. NPC sheets are the DM's alone: a player's device never holds another account's NPCs.
import { markNpcDirty } from '../sync/outbox'
import { normalize } from './engine'
import type { NpcSheet } from './types'

const KEY = 'ff.npcs.v1'
const CHANGED = 'ff:npcs-changed'

function readAll(): NpcSheet[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.flatMap(n => { try { return [normalize(n)] } catch { return [] } }) : []
  } catch {
    return []
  }
}

function writeAll(list: NpcSheet[], changedId?: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked; the sheet still works in memory.
  }
  globalThis.window?.dispatchEvent(new CustomEvent(CHANGED, { detail: changedId }))
}

/** The DM's NPCs, newest first. With `partyId`, only that campaign's and the ones with no campaign. */
export async function listNpcs(ownerId: string, partyId?: string): Promise<NpcSheet[]> {
  return readAll()
    .filter(n => n.ownerId === ownerId && (!partyId || !n.partyId || n.partyId === partyId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getNpc(id: string): Promise<NpcSheet | undefined> {
  return readAll().find(n => n.id === id)
}

/** Saves and queues the sheet for the cloud. */
export async function saveNpc(npc: NpcSheet): Promise<NpcSheet> {
  const next = normalize({ ...npc, updatedAt: new Date().toISOString() })
  writeAll([...readAll().filter(x => x.id !== npc.id), next], npc.id)
  markNpcDirty(npc.id, npc.ownerId)
  return next
}

export async function deleteNpc(id: string): Promise<void> {
  const cur = readAll().find(n => n.id === id)
  writeAll(readAll().filter(n => n.id !== id), id)
  if (cur) markNpcDirty(id, cur.ownerId, true)
}

/** Fires with the changed sheet's id (undefined for a bulk change), in this tab or another. */
export function onNpcsChanged(fn: (id?: string) => void): () => void {
  const local = (e: Event) => fn((e as CustomEvent<string | undefined>).detail)
  const other = (e: StorageEvent) => { if (e.key === KEY) fn() }
  window.addEventListener(CHANGED, local)
  window.addEventListener('storage', other)
  return () => { window.removeEventListener(CHANGED, local); window.removeEventListener('storage', other) }
}

// ---- Sync hooks (src/sync/npcs.ts). These never mark the outbox. ----

/** Every NPC on this device for the account, synced or not. */
export function localNpcs(ownerId: string): NpcSheet[] {
  return readAll().filter(n => n.ownerId === ownerId)
}

/** Writes the server's copy (or removes it when `npc` is null). */
export function applyRemoteNpc(npc: NpcSheet | null, id: string): void {
  const rest = readAll().filter(x => x.id !== id)
  writeAll(npc ? [...rest, normalize(npc)] : rest, id)
}
