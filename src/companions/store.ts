// Companion store. Async like src/storage so a hosted backend can replace localStorage
// without changing callers. Companions point at their character by characterId.
import type { Companion } from './types'

const KEY = 'ff.companions.v1'
const CHANGED = 'ff:companions-changed'

function readAll(): Companion[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? (list as Companion[]) : []
  } catch {
    return []
  }
}

function writeAll(list: Companion[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked; nothing else to do offline.
  }
  window.dispatchEvent(new Event(CHANGED))
}

export async function listCompanions(characterId: string): Promise<Companion[]> {
  return readAll().filter(c => c.characterId === characterId)
}

export async function saveCompanion(comp: Companion): Promise<Companion> {
  const list = readAll()
  const next = { ...comp, updatedAt: new Date().toISOString() }
  const i = list.findIndex(c => c.id === comp.id)
  if (i >= 0) list[i] = next
  else list.push(next)
  writeAll(list)
  return next
}

export async function deleteCompanion(id: string): Promise<void> {
  writeAll(readAll().filter(c => c.id !== id))
}

/** Call when a character is deleted. */
export async function deleteCompanionsFor(characterId: string): Promise<void> {
  const list = readAll()
  const kept = list.filter(c => c.characterId !== characterId)
  if (kept.length !== list.length) writeAll(kept)
}

/** Calls fn whenever companions change, in this tab or another one. Returns an unsubscribe function. */
export function onCompanionsChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key === KEY) fn() }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
  }
}
