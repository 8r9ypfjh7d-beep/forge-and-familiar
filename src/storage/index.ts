// Character and profile store. Async on purpose: today it is localStorage, later a hosted
// backend with accounts can implement the same API. Owned by the live sheet thread.
import type { Character, UserProfile } from '../model/character'

const KEY = 'ff.characters.v1'
const PROFILES_KEY = 'ff.profiles.v1'
const ACTIVE_KEY = 'ff.activeProfile.v1'
const CHANGED = 'ff:characters-changed'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked; nothing else to do offline.
  }
}

function readCharacters(): Character[] {
  const list = read<unknown>(KEY, [])
  return Array.isArray(list) ? (list as Character[]) : []
}

function writeCharacters(list: Character[], changedId: string) {
  write(KEY, list)
  window.dispatchEvent(new CustomEvent<string>(CHANGED, { detail: changedId }))
}

export async function listCharacters(ownerId: string): Promise<Character[]> {
  return readCharacters().filter(c => c.ownerId === ownerId)
}

export async function getCharacter(id: string): Promise<Character | undefined> {
  return readCharacters().find(c => c.id === id)
}

export async function saveCharacter(c: Character): Promise<Character> {
  const list = readCharacters()
  const next = { ...c, updatedAt: new Date().toISOString() }
  const i = list.findIndex(x => x.id === c.id)
  if (i >= 0) list[i] = next
  else list.push(next)
  writeCharacters(list, c.id)
  return next
}

export async function deleteCharacter(id: string): Promise<void> {
  writeCharacters(readCharacters().filter(c => c.id !== id), id)
}

export async function listProfiles(): Promise<UserProfile[]> {
  return read<UserProfile[]>(PROFILES_KEY, [])
}

export async function saveProfile(p: UserProfile): Promise<void> {
  const list = read<UserProfile[]>(PROFILES_KEY, []).filter(x => x.id !== p.id)
  write(PROFILES_KEY, [...list, p])
}

export const getActiveProfileId = (): string | null => read<string | null>(ACTIVE_KEY, null)
export const setActiveProfileId = (id: string) => write(ACTIVE_KEY, id)

/**
 * Calls fn with the character id whenever a character is saved or deleted,
 * in this tab or another one. Returns an unsubscribe function.
 */
export function onCharactersChanged(fn: (id?: string) => void): () => void {
  const local = (e: Event) => fn((e as CustomEvent<string>).detail)
  const other = (e: StorageEvent) => { if (e.key === KEY) fn() }
  window.addEventListener(CHANGED, local)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, local)
    window.removeEventListener('storage', other)
  }
}
