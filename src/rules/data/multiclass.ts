import type { Abilities, ArmorCategory, WeaponCategory } from '../types'

// Multiclassing tables. Prerequisites are the same in SRD 5.1 and 5.2; what a later class grants differs.

/** Ability minimums. `all` must all be met; `any` needs one of them (Fighter). */
export interface MulticlassPrereq {
  all?: Partial<Abilities>
  any?: Partial<Abilities>
}

export const MULTICLASS_PREREQS: Record<string, MulticlassPrereq> = {
  artificer: { all: { int: 13 } },
  barbarian: { all: { str: 13 } },
  bard: { all: { cha: 13 } },
  cleric: { all: { wis: 13 } },
  druid: { all: { wis: 13 } },
  fighter: { any: { str: 13, dex: 13 } },
  monk: { all: { dex: 13, wis: 13 } },
  paladin: { all: { str: 13, cha: 13 } },
  ranger: { all: { dex: 13, wis: 13 } },
  rogue: { all: { dex: 13 } },
  sorcerer: { all: { cha: 13 } },
  warlock: { all: { cha: 13 } },
  wizard: { all: { int: 13 } },
}

/** What a class grants when it is not the character's first class. */
export interface MulticlassGrant {
  armor: ArmorCategory[]
  weapons: WeaponCategory[]
  weaponIds?: string[]
  /** Extra skill picks (any skill for Bard, class list for Ranger/Rogue). */
  skills?: number
  other?: string[]
}

export const MULTICLASS_PROFICIENCIES: Record<string, MulticlassGrant> = {
  artificer: { armor: ['light', 'medium', 'shield'], weapons: [], other: ["thieves' tools", "tinker's tools"] },
  barbarian: { armor: ['shield'], weapons: ['simple', 'martial'] },
  bard: { armor: ['light'], weapons: [], skills: 1, other: ['one musical instrument'] },
  cleric: { armor: ['light', 'medium', 'shield'], weapons: [] },
  druid: { armor: ['light', 'medium', 'shield'], weapons: [] },
  fighter: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] },
  monk: { armor: [], weapons: ['simple'], weaponIds: ['shortsword'] },
  paladin: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] },
  ranger: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], skills: 1 },
  rogue: { armor: ['light'], weapons: [], skills: 1, other: ["thieves' tools"] },
  sorcerer: { armor: [], weapons: [] },
  warlock: { armor: ['light'], weapons: ['simple'] },
  wizard: { armor: [], weapons: [] },
}

/** SRD 5.2 (2024): what a class grants when it is not the first. */
export const MULTICLASS_PROFICIENCIES_2024: Record<string, MulticlassGrant> = {
  artificer: { armor: ['light', 'medium', 'shield'], weapons: [], other: ["thieves' tools", "tinker's tools"] },
  barbarian: { armor: ['shield'], weapons: ['martial'] },
  bard: { armor: ['light'], weapons: [], skills: 1, other: ['one musical instrument'] },
  cleric: { armor: ['light', 'medium', 'shield'], weapons: [] },
  druid: { armor: ['light', 'shield'], weapons: [] },
  fighter: { armor: ['light', 'medium', 'shield'], weapons: ['martial'] },
  monk: { armor: [], weapons: [] },
  paladin: { armor: ['light', 'medium', 'shield'], weapons: ['martial'] },
  ranger: { armor: ['light', 'medium', 'shield'], weapons: ['martial'], skills: 1 },
  rogue: { armor: ['light'], weapons: [], skills: 1, other: ["thieves' tools"] },
  sorcerer: { armor: [], weapons: [] },
  warlock: { armor: ['light'], weapons: [] },
  wizard: { armor: [], weapons: [] },
}

/** Resources that give no extra uses when a second class grants them again. */
export const NON_STACKING_RESOURCES = ['channel-divinity']

/** Features that don't stack across classes. */
export const NON_STACKING_FEATURES = ['Extra Attack', 'Unarmored Defense']
