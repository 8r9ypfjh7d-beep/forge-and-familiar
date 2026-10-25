// Encounter store. Async like src/storage so a hosted backend can replace localStorage later.
import type { Encounter } from './types'

const KEY = 'ff.encounters.v1'

function readAll(): Encounter[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeAll(list: Encounter[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked; the encounter still runs in memory.
  }
}

export async function listEncounters(ownerId: string): Promise<Encounter[]> {
  return readAll().filter(e => e.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getEncounter(id: string): Promise<Encounter | undefined> {
  return readAll().find(e => e.id === id)
}

export async function saveEncounter(e: Encounter): Promise<Encounter> {
  const next = { ...e, updatedAt: new Date().toISOString() }
  writeAll([...readAll().filter(x => x.id !== e.id), next])
  return next
}

export async function deleteEncounter(id: string): Promise<void> {
  writeAll(readAll().filter(e => e.id !== id))
}
