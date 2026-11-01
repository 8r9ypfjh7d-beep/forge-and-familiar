// Session notes store. A cloud party's notes go through Supabase (cloud.ts) and reach players live once
// shared; this device keeps a copy so they open offline. A local party's notes stay on this device.
// What each player has read is kept per player per device. A save that cannot reach the server (a basement
// with no signal) stays on this device as pending and goes up on the next refresh, so no jot is lost.
import { cloudForParty } from '../party/store'
import { deleteNoteRemote, pullNotes, pullSecrets, saveNoteRemote, saveSecretRemote } from './cloud'
import type { SessionNote, SessionSecret } from './types'

const NOTES = 'ff.sessionNotes.v1'
const SECRETS = 'ff.sessionNotes.secrets.v1'
const SEEN = 'ff.sessionNotes.seen.v1'
const PENDING = 'ff.sessionNotes.pending.v1'
const CHANGED = 'ff:session-notes-changed'

interface Pending { kind: 'note' | 'secret'; id: string }

function readJson<T>(key: string): T[] {
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(list) ? (list as T[]) : []
  } catch {
    return []
  }
}

function writeJson(key: string, list: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // Full device: the server keeps the note for cloud parties; local ones stay as they were.
  }
  window.dispatchEvent(new Event(CHANGED))
}

const readNotes = () => readJson<SessionNote>(NOTES)
const readSecrets = () => readJson<SessionSecret>(SECRETS)

const readPending = () => readJson<Pending>(PENDING)
const isPending = (kind: Pending['kind'], id: string) => readPending().some(p => p.kind === kind && p.id === id)
function setPending(kind: Pending['kind'], id: string, on: boolean) {
  const rest = readPending().filter(p => !(p.kind === kind && p.id === id))
  writeJson(PENDING, on ? [...rest, { kind, id }] : rest)
}

/** How many saves of this party are waiting for a connection. */
export function pendingCount(partyId: string): number {
  const notes = readNotes(), secrets = readSecrets()
  return readPending().filter(p => (p.kind === 'note' ? notes : secrets).some(x => x.id === p.id && x.partyId === partyId)).length
}

/** Puts the server's copy of one party's list in place of this device's, keeping items still waiting to go up. */
function replaceParty<T extends { id: string; partyId: string }>(key: string, kind: Pending['kind'], partyId: string, remote: T[]) {
  const all = readJson<T>(key)
  const here = all.filter(x => x.partyId === partyId)
  const waiting = here.filter(x => isPending(kind, x.id))
  const next = [...remote.filter(r => !waiting.some(w => w.id === r.id)), ...waiting]
  if (JSON.stringify(here) !== JSON.stringify(next)) writeJson(key, [...all.filter(x => x.partyId !== partyId), ...next])
}

/** Sends this party's waiting saves. Notes go before their private halves, which need them on the server. */
async function pushPending(db: NonNullable<Awaited<ReturnType<typeof cloudForParty>>>, partyId: string) {
  for (const p of [...readPending()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'note' ? -1 : 1))) {
    const item = (p.kind === 'note' ? readNotes() : readSecrets()).find(x => x.id === p.id && x.partyId === partyId)
    if (!item) continue
    try {
      if (p.kind === 'note') await saveNoteRemote(db, item as SessionNote)
      else await saveSecretRemote(db, item as SessionSecret)
      setPending(p.kind, p.id, false)
    } catch {
      return
    }
  }
}

/** Sends waiting saves, then replaces this device's copy of a cloud party's notes with the server's. */
export async function refreshNotes(partyId: string): Promise<void> {
  const db = await cloudForParty(partyId)
  if (!db) return
  await pushPending(db, partyId)
  const [notes, secrets] = await Promise.all([pullNotes(db, partyId), pullSecrets(db, partyId)])
  if (notes) replaceParty(NOTES, 'note', partyId, notes)
  if (secrets) replaceParty(SECRETS, 'secret', partyId, secrets)
}

/** Tries the server; a failed save stays on this device and is marked to go up later. */
async function upload(kind: Pending['kind'], partyId: string, id: string, send: (db: NonNullable<Awaited<ReturnType<typeof cloudForParty>>>) => Promise<void>) {
  const db = await cloudForParty(partyId)
  if (!db) return
  try {
    // A note's earlier save still waiting means the server may not have it yet; keep the order.
    if (kind === 'secret' && isPending('note', id)) throw new Error('note first')
    await send(db)
    if (isPending(kind, id)) setPending(kind, id, false)
  } catch {
    setPending(kind, id, true)
  }
}

export async function listNotes(partyId: string): Promise<SessionNote[]> {
  return readNotes().filter(n => n.partyId === partyId)
}

export async function listSecrets(partyId: string): Promise<SessionSecret[]> {
  return readSecrets().filter(s => s.partyId === partyId)
}

export async function saveNote(n: SessionNote): Promise<SessionNote> {
  const next = { ...n, updatedAt: new Date().toISOString() }
  writeJson(NOTES, [...readNotes().filter(x => x.id !== n.id), next])
  await upload('note', n.partyId, n.id, db => saveNoteRemote(db, next))
  return next
}

/** The private half. On the server its note must exist first, so save the note before its first secret. */
export async function saveSecret(s: SessionSecret): Promise<SessionSecret> {
  const next = { ...s, updatedAt: new Date().toISOString() }
  writeJson(SECRETS, [...readSecrets().filter(x => x.id !== s.id), next])
  await upload('secret', s.partyId, s.id, db => saveSecretRemote(db, next))
  return next
}

export async function deleteNote(id: string): Promise<void> {
  const n = readNotes().find(x => x.id === id)
  const db = n ? await cloudForParty(n.partyId) : null
  // The server must agree first (throws offline); a note it never had deletes as a no-op.
  if (db) await deleteNoteRemote(db, id)
  setPending('note', id, false)
  setPending('secret', id, false)
  writeJson(NOTES, readNotes().filter(x => x.id !== id))
  writeJson(SECRETS, readSecrets().filter(x => x.id !== id))
}

/** Note ids this player has opened on this device. */
export function seenNotes(userId: string): string[] {
  return readJson<{ userId: string; id: string }>(SEEN).filter(s => s.userId === userId).map(s => s.id)
}

export function markNoteSeen(userId: string, id: string) {
  const all = readJson<{ userId: string; id: string }>(SEEN)
  if (!all.some(s => s.userId === userId && s.id === id)) writeJson(SEEN, [...all, { userId, id }])
}

/** Calls fn whenever notes change, in this tab or another one. Returns an unsubscribe function. */
export function onNotesChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key === NOTES || e.key === SECRETS || e.key === SEEN || e.key === PENDING) fn() }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
  }
}
