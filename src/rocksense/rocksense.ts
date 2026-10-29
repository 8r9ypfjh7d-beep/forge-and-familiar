// Roy's Stone Sense: a dwarf presses a button, the rock speaks, and it says nothing useful.
// Pure picking logic plus a per-device count of rocks sensed; the overlay is RockSense.tsx.
import type { Character } from '../model/character'

/** Number of `rock.fact<n>` lines in the locales. */
export const ROCK_FACTS = 30
/** Number of `rock.moist<n>` readings. */
export const MOISTURE_LEVELS = 6

/** Dwarves (any edition, any subrace, homebrew dwarves too) and Roy himself get the button. */
export function canSenseRock(c: Pick<Character, 'raceId' | 'subraceId' | 'ownerId'>): boolean {
  if (c.ownerId === 'acct-roy') return true
  return /dwarf|mountain/i.test(`${c.raceId} ${c.subraceId ?? ''}`)
}

/** A fact number from 1 to `count`, never the same as the last one shown. */
export function pickFact(last: number | undefined, random: () => number = Math.random, count = ROCK_FACTS): number {
  const n = 1 + Math.floor(random() * count)
  if (n !== last || count < 2) return n
  return (n % count) + 1
}

/** A moisture reading from 1 to MOISTURE_LEVELS. The age reading is always "very old". */
export function pickMoisture(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * MOISTURE_LEVELS)
}

const countKey = (id: string) => `ff.rocksSensed.v1.${id}`

export function rocksSensed(characterId: string): number {
  try { return Number(localStorage.getItem(countKey(characterId))) || 0 } catch { return 0 }
}

/** Adds one to this character's count on this device and returns the new total. */
export function senseOneMoreRock(characterId: string): number {
  const n = rocksSensed(characterId) + 1
  try { localStorage.setItem(countKey(characterId), String(n)) } catch { /* private mode */ }
  return n
}
