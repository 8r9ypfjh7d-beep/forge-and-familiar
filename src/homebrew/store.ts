// Homebrew pack library. Async like src/storage so a backend can replace localStorage later.
// Every pack on this device is active: its items are registered with the rules engine so
// characters holding them keep their attacks, AC and weight.
import { registerHomebrewItems } from '../rules'
import { sanitizePack } from './pack'
import type { HomebrewPack } from './types'

const KEY = 'ff.homebrew.v1'
const CHANGED = 'ff:homebrew-changed'

function readPacks(): HomebrewPack[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.flatMap(p => {
      try {
        return [sanitizePack(p)]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

function register(packs: HomebrewPack[]) {
  registerHomebrewItems(packs.flatMap(p => p.items))
}

function writePacks(packs: HomebrewPack[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(packs))
  } catch {
    // Storage full or blocked; nothing else to do offline.
  }
  register(packs)
  window.dispatchEvent(new Event(CHANGED))
}

export async function listPacks(): Promise<HomebrewPack[]> {
  return readPacks()
}

export async function savePack(pack: HomebrewPack): Promise<HomebrewPack> {
  const next = { ...pack, history: undefined, updatedAt: new Date().toISOString() }
  writePacks([...readPacks().filter(p => p.id !== pack.id), next])
  return next
}

export async function deletePack(id: string): Promise<void> {
  writePacks(readPacks().filter(p => p.id !== id))
}

export type ImportResult = 'added' | 'updated' | 'unchanged'

/** Adds a friend's pack, or replaces our copy when theirs is newer. */
export async function importPack(pack: HomebrewPack): Promise<ImportResult> {
  const packs = readPacks()
  const existing = packs.find(p => p.id === pack.id)
  if (existing && Date.parse(existing.updatedAt) >= Date.parse(pack.updatedAt)) return 'unchanged'
  writePacks([...packs.filter(p => p.id !== pack.id), { ...pack, history: undefined }])
  return existing ? 'updated' : 'added'
}

/** Calls fn when packs change in this tab or another one. Returns an unsubscribe function. */
export function onPacksChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => {
    if (e.key !== KEY) return
    register(readPacks())
    fn()
  }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
  }
}

/** Registers stored homebrew items with the rules engine. Call once at startup. */
export function loadHomebrew() {
  register(readPacks())
}
