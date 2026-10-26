import type { Character } from '../model/character'
import { normalize } from './engine'

/** A level 5 fighter / 2 wizard used by tests and the dev demo. */
export function makeCharacter(overrides: Partial<Character> = {}): Character {
  const now = new Date().toISOString()
  const base: Character = {
    id: 'demo', ownerId: 'local', schemaVersion: 1, name: 'Brannoc Ashvale', playerName: '', alignment: 'Neutral Good',
    raceId: 'human', backgroundId: 'soldier',
    classes: [{ classId: 'fighter', level: 5 }, { classId: 'wizard', level: 2 }],
    xp: 23000, abilityMethod: 'standard',
    baseAbilities: { str: 16, dex: 12, con: 14, int: 14, wis: 10, cha: 8 },
    freeAbilityBonuses: [], chosenSkills: [], inventory: [], coins: { cp: 0, sp: 0, gp: 15 }, notes: '',
    state: {
      currentHp: Infinity, tempHp: 0, deathSaves: { successes: 0, failures: 0 }, hitDiceSpent: {},
      spellSlotsUsed: [], pactSlotsUsed: 0, resources: {}, conditions: [], counters: [],
    },
    createdAt: now, updatedAt: now,
  }
  return normalize({ ...base, ...overrides })
}
