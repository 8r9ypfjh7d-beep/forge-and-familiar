// Saved companion shape and the SRD stat blocks it points to.
import type { Abilities, ConditionId } from '../rules/types'

export type CompanionKind = 'familiar' | 'companion' | 'summon' | 'wildShape'

export type CreatureSize = 'Tiny' | 'Small' | 'Medium' | 'Large'

export interface CreatureAction {
  name: string
  /** Attack bonus; undefined for actions that are not attack rolls. */
  toHit?: number
  /** Dice notation, e.g. "2d4+2". */
  damage?: string
  damageType?: string
  /** Reach, range, saves and riders, as the SRD writes them. */
  text?: string
}

/** One SRD 5.1 stat block (or a player-made one). Read-only data. */
export interface Creature {
  id: string
  name: string
  size: CreatureSize
  type: string
  /** Challenge rating as a number: 0.125, 0.25, 0.5, 1... */
  cr: number
  ac: number
  acNote?: string
  hp: number
  hitDice: string
  speed: { walk: number; fly?: number; swim?: number; climb?: number; burrow?: number }
  abilities: Abilities
  /** Skill and save bonuses as printed, e.g. "Perception +3, Stealth +4". */
  skills?: string
  senses: string
  traits: { name: string; text: string }[]
  actions: CreatureAction[]
  /** Forms offered by Find Familiar, or only through Pact of the Chain. */
  familiar?: 'any' | 'chain'
}

/** A familiar, pet, summon or wild shape form tied to one character. Saved data. */
export interface Companion {
  id: string
  characterId: string
  ownerId: string
  kind: CompanionKind
  name: string
  /** SRD creature id, or 'custom' with `custom` filled in. */
  creatureId: string
  custom?: Creature
  /** Chosen at creation (average or rolled), editable later. */
  maxHp: number
  currentHp: number
  tempHp: number
  conditions: ConditionId[]
  notes: string
  createdAt: string
  updatedAt: string
}
