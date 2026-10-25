// Journal store, one journal per character. Async like src/storage so a hosted backend can
// replace localStorage later. Saves are whole-journal writes; the view always edits the latest copy.
import { emptyJournal } from './journal'
import type { Journal } from './types'

const PREFIX = 'ff.journal.v1.'
const key = (characterId: string) => PREFIX + characterId
const CHANGED = 'ff:journal-changed'

function read(characterId: string): Journal {
  try {
    const raw = JSON.parse(localStorage.getItem(key(characterId)) ?? 'null')
    if (raw && typeof raw === 'object') return { ...emptyJournal(characterId), ...raw, characterId }
  } catch {
    // Unreadable save; start from an empty journal rather than crash.
  }
  return emptyJournal(characterId)
}

export async function getJournal(characterId: string): Promise<Journal> {
  return read(characterId)
}

export async function saveJournal(j: Journal): Promise<Journal> {
  const next = { ...j, updatedAt: new Date().toISOString() }
  try {
    localStorage.setItem(key(j.characterId), JSON.stringify(next))
  } catch {
    // Storage full or blocked; nothing else to do offline.
  }
  window.dispatchEvent(new CustomEvent<string>(CHANGED, { detail: j.characterId }))
  return next
}

/** Applies `change` to the latest saved copy, so two tabs editing one journal don't lose each other's records. */
export async function updateJournal(characterId: string, change: (j: Journal) => Journal): Promise<Journal> {
  return saveJournal(change(read(characterId)))
}

/** Call when a character is deleted. */
export async function deleteJournalFor(characterId: string): Promise<void> {
  try {
    localStorage.removeItem(key(characterId))
  } catch {
    // Blocked storage; nothing to remove.
  }
  window.dispatchEvent(new CustomEvent<string>(CHANGED, { detail: characterId }))
}

/** Calls fn with the character id whenever a journal changes, in this tab or another one. */
export function onJournalChanged(fn: (characterId: string) => void): () => void {
  const local = (e: Event) => fn((e as CustomEvent<string>).detail)
  const other = (e: StorageEvent) => { if (e.key?.startsWith(PREFIX)) fn(e.key.slice(PREFIX.length)) }
  window.addEventListener(CHANGED, local)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, local)
    window.removeEventListener('storage', other)
  }
}
