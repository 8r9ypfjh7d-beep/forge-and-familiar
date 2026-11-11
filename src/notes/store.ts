// Party notes store. A cloud party's notes go through Supabase (cloud.ts); this device keeps a copy so they
// open offline. A save that cannot reach the server stays here as pending and goes up on the next refresh.
// Unsaved typing is a draft kept only on this device, so a player can write during play and share on Save.
import { cloudForParty } from '../party/store'
import { deleteNoteRemote, pullNotes, saveNoteRemote } from './cloud'
import type { NoteDraft, PartyNote } from './types'

const NOTES = 'ff.partyNotes.v1'
const PENDING = 'ff.partyNotes.pending.v1'
const DRAFTS = 'ff.partyNotes.drafts.v1'
const CHANGED = 'ff:party-notes-changed'

function readJson<T>(key: string): T[] {
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(list) ? (list as T[]) : []
  } catch {
    return []
  }
}

function writeJson(key: string, list: unknown[], quiet = false) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // Full device: the server keeps cloud notes; local ones stay as they were.
  }
  if (!quiet) window.dispatchEvent(new Event(CHANGED))
}

const readNotes = () => readJson<PartyNote>(NOTES)
const readPending = () => readJson<string>(PENDING)
const isPending = (id: string) => readPending().includes(id)
function setPending(id: string, on: boolean) {
  const rest = readPending().filter(p => p !== id)
  writeJson(PENDING, on ? [...rest, id] : rest)
}

/** How many of this party's saves are waiting for a connection. */
export function pendingCount(partyId: string): number {
  const notes = readNotes()
  return readPending().filter(id => notes.some(n => n.id === id && n.partyId === partyId)).length
}

type Db = NonNullable<Awaited<ReturnType<typeof cloudForParty>>>

async function pushPending(db: Db, partyId: string) {
  for (const id of readPending()) {
    const n = readNotes().find(x => x.id === id && x.partyId === partyId)
    if (!n) continue
    try {
      await saveNoteRemote(db, n)
      setPending(id, false)
    } catch {
      return
    }
  }
}

/** Sends waiting saves, then puts the server's copy of a cloud party's notes in place of this device's. */
export async function refreshNotes(partyId: string): Promise<void> {
  const db = await cloudForParty(partyId)
  if (!db) return
  await pushPending(db, partyId)
  const remote = await pullNotes(db, partyId)
  if (!remote) return
  const all = readNotes()
  const here = all.filter(n => n.partyId === partyId)
  const waiting = here.filter(n => isPending(n.id))
  const next = [...remote.filter(r => !waiting.some(w => w.id === r.id)), ...waiting]
  if (JSON.stringify(here) !== JSON.stringify(next)) writeJson(NOTES, [...all.filter(n => n.partyId !== partyId), ...next])
}

export async function listNotes(partyId: string): Promise<PartyNote[]> {
  return readNotes().filter(n => n.partyId === partyId)
}

/** Synchronous look-up, for one-time moves that must not run twice. */
export const hasNote = (id: string) => readNotes().some(n => n.id === id)

export async function saveNote(n: PartyNote): Promise<PartyNote> {
  const next = { ...n, updatedAt: new Date().toISOString() }
  writeJson(NOTES, [...readNotes().filter(x => x.id !== n.id), next])
  const db = await cloudForParty(n.partyId)
  if (db) {
    try {
      await saveNoteRemote(db, next)
      if (isPending(n.id)) setPending(n.id, false)
    } catch {
      setPending(n.id, true)
    }
  }
  return next
}

/** The server must agree first (throws offline); a note it never had deletes as a no-op. */
export async function deleteNote(id: string): Promise<void> {
  const n = readNotes().find(x => x.id === id)
  const db = n ? await cloudForParty(n.partyId) : null
  if (db) await deleteNoteRemote(db, id)
  setPending(id, false)
  clearDraft(id)
  writeJson(NOTES, readNotes().filter(x => x.id !== id))
}

/** Unsaved drafts this player has on this device. */
export function listDrafts(partyId: string, userId: string): NoteDraft[] {
  return readJson<NoteDraft>(DRAFTS).filter(d => d.note.partyId === partyId && d.note.authorId === userId)
}

export const getDraft = (id: string) => readJson<NoteDraft>(DRAFTS).find(d => d.note.id === id)

/** Saved quietly on every pause in typing (lists refresh when the editor closes); nobody else sees it until Save. */
export function saveDraft(note: PartyNote, isNew: boolean, quiet = true) {
  writeJson(DRAFTS, [...readJson<NoteDraft>(DRAFTS).filter(d => d.note.id !== note.id), { note, isNew, at: new Date().toISOString() }], quiet)
}

export function clearDraft(id: string) {
  const all = readJson<NoteDraft>(DRAFTS)
  if (all.some(d => d.note.id === id)) writeJson(DRAFTS, all.filter(d => d.note.id !== id))
}

/** Calls fn whenever notes change, in this tab or another one. Returns an unsubscribe function. */
export function onNotesChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key === NOTES || e.key === PENDING || e.key === DRAFTS) fn() }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
  }
}
