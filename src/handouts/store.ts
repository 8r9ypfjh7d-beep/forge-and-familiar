// Hand-out store. Hand-outs of a cloud party go through Supabase (cloud.ts) and reach players on
// any device, live; this device keeps a copy so they still open offline. Hand-outs of a local party
// stay on this device, as before.
import { cloudForParty, getParty } from '../party/store'
import { clearSeen, deleteRemote, markSeenRemote, pullHandouts, saveRemote } from './cloud'
import type { Handout } from './types'
import { markSeen } from './logic'

const KEY = 'ff.handouts.v1'
const CHANGED = 'ff:handouts-changed'

/** Thrown when the browser has no room left, usually from too many large images. */
export class HandoutSpaceError extends Error {
  constructor() { super('Not enough storage space on this device for this hand-out.') }
}

function readAll(): Handout[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? (list as Handout[]) : []
  } catch {
    return []
  }
}

function writeAll(list: Handout[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    throw new HandoutSpaceError()
  }
  window.dispatchEvent(new Event(CHANGED))
}

/** Replaces this device's copy of a cloud party's hand-outs with the server's. */
export async function refreshHandouts(partyId: string): Promise<void> {
  const db = await cloudForParty(partyId)
  const remote = db ? await pullHandouts(db, partyId) : null
  if (!remote) return
  const all = readAll()
  const here = all.filter(h => h.partyId === partyId)
  if (JSON.stringify(here) === JSON.stringify(remote)) return
  try {
    writeAll([...all.filter(h => h.partyId !== partyId), ...remote])
  } catch {
    // No room for the copy; the list shows what fits next time.
  }
}

/** Drops hand-outs of parties that no longer exist, so their images stop using space. */
async function withoutOrphans(list: Handout[]): Promise<Handout[]> {
  const ids = [...new Set(list.map(h => h.partyId))]
  const alive = new Set((await Promise.all(ids.map(async id => ((await getParty(id)) ? id : null)))).filter(Boolean))
  return list.filter(h => alive.has(h.partyId))
}

/** All hand-outs of a party. Filter with visibleHandouts() before showing them. */
export async function listHandouts(partyId: string): Promise<Handout[]> {
  return readAll().filter(h => h.partyId === partyId)
}

export async function saveHandout(h: Handout): Promise<Handout> {
  const next = { ...h, updatedAt: new Date().toISOString() }
  const db = await cloudForParty(h.partyId)
  if (db) {
    await saveRemote(db, next)
    if (!next.sentAt) await clearSeen(db, next.id)
    await refreshHandouts(h.partyId)
    return next
  }
  const list = await withoutOrphans(readAll().filter(x => x.id !== h.id))
  writeAll([...list, next])
  return next
}

export async function deleteHandout(id: string): Promise<void> {
  const h = readAll().find(x => x.id === id)
  const db = h ? await cloudForParty(h.partyId) : null
  if (db && h) {
    await deleteRemote(db, id)
    await refreshHandouts(h.partyId)
    return
  }
  writeAll(readAll().filter(x => x.id !== id))
}

export async function markHandoutSeen(id: string, userId: string): Promise<void> {
  const list = readAll()
  const i = list.findIndex(h => h.id === id)
  if (i < 0 || list[i].seenBy[userId]) return
  const db = await cloudForParty(list[i].partyId)
  const seen = markSeen(list[i], userId)
  if (db) await markSeenRemote(db, id, userId, seen.seenBy[userId])
  list[i] = seen
  writeAll(list)
}

/** Calls fn whenever hand-outs change, in this tab or another one. Returns an unsubscribe function. */
export function onHandoutsChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key === KEY) fn() }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
  }
}
