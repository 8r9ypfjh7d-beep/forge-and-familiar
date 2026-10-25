// Hand-out store. Async like src/storage and src/party so a hosted backend can replace
// localStorage later. Until then, hand-outs reach players on the same device only.
import { getParty } from '../party/store'
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
  const list = await withoutOrphans(readAll().filter(x => x.id !== h.id))
  writeAll([...list, next])
  return next
}

export async function deleteHandout(id: string): Promise<void> {
  writeAll(readAll().filter(h => h.id !== id))
}

export async function markHandoutSeen(id: string, userId: string): Promise<void> {
  const list = readAll()
  const i = list.findIndex(h => h.id === id)
  if (i < 0 || list[i].seenBy[userId]) return
  list[i] = markSeen(list[i], userId)
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
