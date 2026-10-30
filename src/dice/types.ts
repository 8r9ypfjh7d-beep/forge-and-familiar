// Shared dice types. Pure data, safe to store and send over the network (Campaign Mode).
import type { Character } from '../model/character'
import type { RollMode } from '../rules/rollMode'

export type { RollMode }

/** Returns an integer in 1..sides. Injected so tests and replays are deterministic. */
export type Rng = (sides: number) => number

export interface DieRoll {
  sides: number
  value: number
  /** False when dropped by keep/drop (advantage, 4d6dl1). */
  kept: boolean
}

export type Term =
  | { kind: 'dice'; sign: 1 | -1; count: number; sides: number; keep?: { type: 'kh' | 'kl' | 'dh' | 'dl'; n: number } }
  | { kind: 'const'; sign: 1 | -1; value: number }

/** `source` names where the term came from on a damage roll ("Greatsword", "Hex"), so the card can show each part. */
export type TermResult =
  | { kind: 'dice'; sign: 1 | -1; notation: string; rolls: DieRoll[]; subtotal: number; source?: string }
  | { kind: 'const'; sign: 1 | -1; value: number; source?: string }

export type RollType = 'custom' | 'check' | 'save' | 'skill' | 'initiative' | 'attack' | 'damage' | 'hitDie' | 'deathSave'

export interface RollResult {
  id: string
  /** Normalised notation, e.g. "2d20kh1+5". */
  notation: string
  label?: string
  type: RollType
  total: number
  terms: TermResult[]
  /** Human-readable, e.g. "[17, ~~4~~] + 5". */
  breakdown: string
  /** Set on d20 rolls (checks, saves, attacks, death saves). */
  d20?: { mode: RollMode; natural: number; crit: boolean; fumble: boolean }
  /** Set on saves the character fails automatically (paralyzed, stunned...). The dice are still rolled. */
  autoFail?: boolean
  /** Who rolled, so a shared or party history can be filtered per character. */
  roller?: { characterId: string; characterName: string }
  /** Shared by the rolls of one action (an attack's to-hit and its damage), so the history shows them as one entry. */
  action?: { id: string; name: string }
  /** On damage rolls: the weapon's or spell's damage type, e.g. "slashing". */
  damageType?: string
  timestamp: string
}

export interface RollOptions {
  /** Situational advantage/disadvantage (cover, Help, the target's conditions). Any of each cancels out (SRD). */
  mode?: RollMode | RollMode[]
  /**
   * The rolling character. Fills `roller`, and on character rolls adds the mode from their own
   * conditions (rules getRollMode) to `mode`.
   */
  character?: Pick<Character, 'id' | 'name' | 'state'>
  /** Extra dice added to a d20 roll (Bless's 1d4), filled from the character's running spells on character rolls. */
  bonusDice?: string[]
  /** Skip the character's conditions, for when the table rules otherwise. */
  ignoreConditions?: boolean
  label?: string
  roller?: RollResult['roller']
  rng?: Rng
  /** Halfling Lucky: a natural 1 on the d20 is rerolled once and the new roll used (the 1 shows struck through). */
  lucky?: boolean
}
