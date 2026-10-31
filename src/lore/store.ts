// Codex store. Entries and chapters of a cloud party go through Supabase (cloud.ts) and reach players
// on any device, live; this device keeps a copy so they still open offline. A local party's Codex
// stays on this device. Pins are per player and per device.
import { cloudForParty, getParty } from '../party/store'
import {
  clearSeen, deleteChapterRemote, deleteRemote, markSeenRemote, pullChapters, pullHandouts,
  removePicture, saveChapterRemote, saveRemote, uploadPicture,
} from './cloud'
import { markSeen, teaserCounts } from './logic'
import type { LoreChapter, LoreEntry } from './types'

const KEY = 'ff.handouts.v1'
const CHAPTERS = 'ff.lore.chapters.v1'
const PINS = 'ff.lore.pins.v1'
const CHANGED = 'ff:handouts-changed'

/** Thrown when the browser has no room left, usually from too many large images. */
export class HandoutSpaceError extends Error {
  constructor() { super('Not enough storage space on this device for this entry.') }
}

function readJson<T>(key: string): T[] {
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(list) ? (list as T[]) : []
  } catch {
    return []
  }
}
const readAll = () => readJson<LoreEntry>(KEY)
const readChapters = () => readJson<LoreChapter>(CHAPTERS)

function writeJson(key: string, list: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    throw new HandoutSpaceError()
  }
  window.dispatchEvent(new Event(CHANGED))
}
const writeAll = (list: LoreEntry[]) => writeJson(KEY, list)
const writeChapters = (list: LoreChapter[]) => writeJson(CHAPTERS, list)

/** Replaces this device's copy of a cloud party's Codex with the server's. */
export async function refreshHandouts(partyId: string): Promise<void> {
  const db = await cloudForParty(partyId)
  if (!db) return
  const [remote, chapters] = await Promise.all([pullHandouts(db, partyId), pullChapters(db, partyId)])
  try {
    if (remote) {
      const all = readAll()
      const here = all.filter(h => h.partyId === partyId)
      if (JSON.stringify(here) !== JSON.stringify(remote)) writeAll([...all.filter(h => h.partyId !== partyId), ...remote])
    }
    if (chapters) {
      const all = readChapters()
      const here = all.filter(c => c.partyId === partyId)
      if (JSON.stringify(here) !== JSON.stringify(chapters)) writeChapters([...all.filter(c => c.partyId !== partyId), ...chapters])
    }
  } catch {
    // No room for the copy; the list shows what fits next time.
  }
}

/** Drops entries of parties that no longer exist, so their images stop using space. */
async function withoutOrphans(list: LoreEntry[]): Promise<LoreEntry[]> {
  const ids = [...new Set(list.map(h => h.partyId))]
  const alive = new Set((await Promise.all(ids.map(async id => ((await getParty(id)) ? id : null)))).filter(Boolean))
  return list.filter(h => alive.has(h.partyId))
}

/** All entries of a party. Filter with visibleHandouts() before showing them. */
export async function listHandouts(partyId: string): Promise<LoreEntry[]> {
  return readAll().filter(h => h.partyId === partyId)
}
export const listEntries = listHandouts

export async function listChapters(partyId: string): Promise<LoreChapter[]> {
  return readChapters().filter(c => c.partyId === partyId).sort((a, b) => a.order - b.order)
}

/** Keeps each chapter's teaser count in step with its drafts (DM's device only). */
async function updateTeasers(partyId: string) {
  const changed = teaserCounts(await listChapters(partyId), await listHandouts(partyId))
  for (const c of changed) await saveChapter(c)
}

export async function saveHandout(h: LoreEntry): Promise<LoreEntry> {
  let next = { ...h, updatedAt: new Date().toISOString() }
  const db = await cloudForParty(h.partyId)
  if (db) {
    // A fresh data-URL picture goes to the bucket; the row then carries only its link.
    if (next.image && !next.imageUrl) {
      const url = await uploadPicture(db, next.partyId, next.id, next.image)
      if (url) next = { ...next, imageUrl: url, image: undefined }
    }
    await saveRemote(db, next)
    if (!next.sentAt) await clearSeen(db, next.id)
    await refreshHandouts(h.partyId)
    await updateTeasers(h.partyId)
    return next
  }
  const list = await withoutOrphans(readAll().filter(x => x.id !== h.id))
  writeAll([...list, next])
  await updateTeasers(h.partyId)
  return next
}
export const saveEntry = saveHandout

export async function deleteHandout(id: string): Promise<void> {
  const h = readAll().find(x => x.id === id)
  const db = h ? await cloudForParty(h.partyId) : null
  if (db && h) {
    await deleteRemote(db, id)
    await removePicture(db, h.imageUrl)
    await refreshHandouts(h.partyId)
    await updateTeasers(h.partyId)
    return
  }
  writeAll(readAll().filter(x => x.id !== id))
  if (h) await updateTeasers(h.partyId)
}
export const deleteEntry = deleteHandout

export async function saveChapter(c: LoreChapter): Promise<LoreChapter> {
  const next = { ...c, updatedAt: new Date().toISOString() }
  const db = await cloudForParty(c.partyId)
  if (db) {
    try {
      await saveChapterRemote(db, next)
      await refreshHandouts(c.partyId)
      return next
    } catch {
      // Server without the chapters table yet (20261030220000_lore.sql): keep the chapter on this device.
      // Players then see its entries under "Unsorted" until the migration runs.
    }
  }
  writeChapters([...readChapters().filter(x => x.id !== c.id), next])
  return next
}

/** Removes a chapter; its entries become unsorted. */
export async function deleteChapter(id: string): Promise<void> {
  const c = readChapters().find(x => x.id === id)
  if (!c) return
  const db = await cloudForParty(c.partyId)
  const loose = readAll().filter(e => e.chapterId === id)
  if (db) {
    for (const e of loose) await saveRemote(db, { ...e, chapterId: undefined })
    await deleteChapterRemote(db, id).catch(() => undefined)
    await refreshHandouts(c.partyId)
  }
  writeAll(readAll().map(e => (e.chapterId === id ? { ...e, chapterId: undefined } : e)))
  writeChapters(readChapters().filter(x => x.id !== id))
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

/** Pinned entry ids for this player on this device. */
export function pinned(userId: string): string[] {
  return readJson<{ userId: string; id: string }>(PINS).filter(p => p.userId === userId).map(p => p.id)
}
export function togglePin(userId: string, id: string) {
  const all = readJson<{ userId: string; id: string }>(PINS)
  const has = all.some(p => p.userId === userId && p.id === id)
  writeJson(PINS, has ? all.filter(p => !(p.userId === userId && p.id === id)) : [...all, { userId, id }])
}

/** Calls fn whenever the Codex changes, in this tab or another one. Returns an unsubscribe function. */
export function onHandoutsChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key === KEY || e.key === CHAPTERS || e.key === PINS) fn() }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
  }
}
