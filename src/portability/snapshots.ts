// Level snapshots: a saved copy of a character's build, so a level-up can be rolled back.
// Pure TypeScript. Persistence is in store.ts.
import type { Character } from '../model/character'
import { normalize } from '../sheet/engine'

export interface Snapshot {
  id: string
  characterId: string
  label: string
  /** Total character level when taken. */
  level: number
  takenAt: string
  /** The character at that moment, without its portrait (restores keep the current one). */
  character: Character
}

/** What a rollback brings back. Everything else (name, notes, portrait, gear, coins) stays as it is now. */
export const BUILD_FIELDS = [
  'raceId', 'subraceId', 'backgroundId', 'classes', 'customSubclasses', 'xp', 'abilityMethod', 'rolledScores',
  'baseAbilities', 'freeAbilityBonuses', 'racialBonusTargets', 'chosenSkills', 'customBackground', 'chosenLanguages', 'chosenTools',
  'traitChoices', 'improvements', 'equipmentPicks',
] as const satisfies readonly (keyof Character)[]

export const totalLevel = (c: Pick<Character, 'classes'>) => c.classes.reduce((n, cl) => n + cl.level, 0)

const uid = () => crypto.randomUUID()

export function takeSnapshot(c: Character, label?: string, now = new Date()): Snapshot {
  const { portrait: _, ...character } = structuredClone(c)
  const level = totalLevel(c)
  return {
    id: uid(),
    characterId: c.id,
    label: label?.trim() || `Level ${level}`,
    level,
    takenAt: now.toISOString(),
    character,
  }
}

/**
 * Puts the snapshot's build back on the current character. Play state is kept but
 * clamped to the restored maxima (HP, slots, hit dice, resources).
 */
export function restoreSnapshot(current: Character, snap: Snapshot): Character {
  const next: Character = { ...current }
  const from = structuredClone(snap.character)
  for (const key of BUILD_FIELDS) {
    if (from[key] === undefined) delete next[key]
    else (next as unknown as Record<string, unknown>)[key] = from[key]
  }
  return normalize(next)
}
