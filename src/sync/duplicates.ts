// Same character twice: a player who built the same hero on two devices before signing in on
// both gets two cloud copies with different ids. Copies with the same name are found here;
// identical builds merge on their own, different builds are the player's call (DuplicatePrompt).
import type { Character } from '../model/character'
import { deleteCharacter } from '../storage'
import { addSnapshots, snapshotsFor } from '../portability/store'
import { takeSnapshot } from '../portability/snapshots'
import { buildDiffers } from './engine'

const KEY = 'ff.duplicates.v1'
/** Label of the snapshot that keeps the copy that was let go. */
export const MERGE_LABEL = 'Other copy (before merge)'

const nameKey = (c: Character) => c.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
const groupKey = (ids: string[]) => [...ids].sort().join('|')

function readKept(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? (list as string[]) : []
  } catch {
    return []
  }
}

/** "Keep both": this group is not asked about again on this device. */
export function keepBoth(group: Character[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...readKept(), groupKey(group.map(c => c.id))]))
  } catch {
    // Storage full: the question comes back next time.
  }
}

/** Groups of two or more characters of one owner with the same name, newest copy first. */
export function findDuplicates(chars: readonly Character[]): Character[][] {
  const kept = new Set(readKept())
  const byName = new Map<string, Character[]>()
  for (const c of chars) {
    if (!c.name.trim()) continue
    const k = `${c.ownerId}\n${nameKey(c)}`
    byName.set(k, [...(byName.get(k) ?? []), c])
  }
  return [...byName.values()]
    .filter(g => g.length > 1 && !kept.has(groupKey(g.map(c => c.id))))
    .map(g => [...g].sort(newestFirst))
}

/** Newer `updatedAt` first; the id breaks ties so every device picks the same copy. */
export const newestFirst = (a: Character, b: Character) =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)

/** True when the copies differ in their build, so the player has to pick one. */
export const needsChoice = (group: readonly Character[]) => group.some(c => buildDiffers(c, group[0]))

/**
 * Keeps `keep` and deletes the other copies everywhere. Nothing is lost: each dropped copy
 * (build, gear, play state) is saved as a snapshot on the kept one, and its level history moves over.
 */
export async function keepCopy(keep: Character, group: readonly Character[]) {
  const drop = group.filter(c => c.id !== keep.id)
  if (!drop.length) return
  const moved = snapshotsFor(drop.map(c => c.id)).map(s => ({ ...s, id: crypto.randomUUID(), characterId: keep.id }))
  const saved = drop.map(c => takeSnapshot({ ...c, id: keep.id }, MERGE_LABEL))
  await addSnapshots([...moved, ...saved])
  for (const c of drop) await deleteCharacter(c.id)
}

/** Merges groups whose copies share one build (keeping the newest) and returns the rest. */
export async function mergeSameBuilds(groups: Character[][]): Promise<Character[][]> {
  const open: Character[][] = []
  for (const g of groups) {
    if (needsChoice(g)) open.push(g)
    else await keepCopy(g[0], g)
  }
  return open
}
