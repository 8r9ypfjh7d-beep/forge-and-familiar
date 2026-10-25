// Saved character shape, shared by the builder (creates it) and the live sheet (plays it).
// Everything not stored here (max HP, AC, modifiers, slots, resource maxima) is derived by src/rules.
import type { QuickCastEntry } from '../quickcast/types'
import type { Abilities, Ability, ConditionId, InventoryEntry, SkillId } from '../rules/types'

export type AbilityMethod = 'standard' | 'pointBuy' | 'manual'
export type HitDie = 'd6' | 'd8' | 'd10' | 'd12'

export interface ClassLevel {
  classId: string
  level: number
  subclassId?: string
}

/** Runtime play state. Owned and mutated by the live sheet. */
export interface CharacterState {
  currentHp: number
  tempHp: number
  deathSaves: { successes: number; failures: number }
  hitDiceSpent: Partial<Record<HitDie, number>>
  /** Used slots, index 0 = 1st level, length 9. */
  spellSlotsUsed: number[]
  pactSlotsUsed: number
  resources: Record<string, { used: number }>
  conditions: ConditionId[]
  exhaustion: number
  /** Player-made trackers (arrows, item charges). */
  counters?: {
    id: string; label: string; max: number; used: number; recharge: 'short' | 'long' | 'dawn' | 'none'
    /** Dawn trackers only: dice regained each dawn, e.g. "1d6+1". Blank means all of them. */
    regain?: string
  }[]
  /** Inspiration from the DM: you have it or you don't. */
  inspiration?: boolean
  /** Magic items the character is attuned to, at most three (SRD 5.1). */
  attuned?: string[]
  /** Ammo and food countdowns (src/supplies). Counts themselves are inventory quantities. */
  supplies?: {
    /** Pieces fired per ammo item id since the last battlefield search. */
    ammoSpent?: Record<string, number>
    /** Long rests in a row taken without eating. */
    daysWithoutFood?: number
  }
  /** In-game time in minutes since 00:00 on day 1. Absent means the default start (day 1, 08:00). */
  clock?: number
}

export const CHARACTER_SCHEMA_VERSION = 1

/** A person using the app. Local profile for now; maps to an auth account once a backend exists. */
export interface UserProfile {
  id: string
  displayName: string
}

export interface Character {
  id: string
  /** UserProfile.id of the player who owns this character. */
  ownerId: string
  schemaVersion: number
  name: string
  playerName: string
  alignment: string
  portrait?: string
  /** Visual theme id from src/themes; missing or unknown means the app's default look. */
  theme?: string
  raceId: string
  subraceId?: string
  backgroundId: string
  /** The builder creates one entry; the array leaves room for multiclassing. */
  classes: ClassLevel[]
  xp: number
  abilityMethod: AbilityMethod
  /** Scores before racial bonuses. Use getAbilityScores() for final scores. */
  baseAbilities: Abilities
  /** Abilities chosen for free racial +1s (Half-Elf). */
  freeAbilityBonuses: Ability[]
  /** Skills picked from class and free race choices. Race and background skills are added by the engine. */
  chosenSkills: SkillId[]
  inventory: InventoryEntry[]
  coins: { cp: number; sp: number; gp: number }
  notes: string
  /** Spells, attacks and resources pinned to the sheet's quick-cast bar, in display order. */
  quickCast?: QuickCastEntry[]
  state: CharacterState
  createdAt: string
  updatedAt: string
}
