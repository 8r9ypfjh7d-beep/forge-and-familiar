// Core data model shared by the builder, the live sheet and the rules engine.

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = (typeof ABILITIES)[number]
export type Abilities = Record<Ability, number>

export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

export type SkillId =
  | 'acrobatics' | 'animalHandling' | 'arcana' | 'athletics' | 'deception'
  | 'history' | 'insight' | 'intimidation' | 'investigation' | 'medicine'
  | 'nature' | 'perception' | 'performance' | 'persuasion' | 'religion'
  | 'sleightOfHand' | 'stealth' | 'survival'

export type Size = 'Small' | 'Medium'

export interface Subrace {
  id: string
  name: string
  abilityBonuses: Partial<Abilities>
  traits: string[]
  /** Extra max HP per character level (Hill Dwarf). */
  hpPerLevel?: number
}

export interface Race {
  id: string
  name: string
  size: Size
  speed: number
  abilityBonuses: Partial<Abilities>
  /** Number of +1 bonuses the player assigns freely (Half-Elf). */
  freeAbilityBonuses?: { count: number; exclude: Ability[] }
  skillProficiencies?: SkillId[]
  /** Number of skills of the player's choice (Half-Elf). */
  freeSkillChoices?: number
  languages: string[]
  traits: string[]
  subraces?: Subrace[]
}

export type ArmorCategory = 'light' | 'medium' | 'heavy' | 'shield'
export type WeaponCategory = 'simple' | 'martial'

export type CasterType = 'full' | 'half' | 'pact' | 'none'

export type RestType = 'short' | 'long'

export interface ResourceDef {
  id: string
  name: string
  /** Uses at a given class level and ability scores; 0 means not yet available. */
  max: (level: number, mods: Abilities) => number
  recharge: RestType
  /** At this level and above, the resource recharges on a short rest instead. */
  shortRestFromLevel?: number
}

export interface ClassDef {
  id: string
  name: string
  hitDie: number
  primary: Ability[]
  savingThrows: Ability[]
  skillChoices: { count: number; from: SkillId[] }
  armor: ArmorCategory[]
  weapons: WeaponCategory[]
  /** Specific weapon ids proficient in addition to categories. */
  weaponIds?: string[]
  caster: CasterType
  spellAbility?: Ability
  /** Monk/Barbarian style unarmored AC: 10 + DEX + this ability. */
  unarmoredDefense?: Ability
  resources: ResourceDef[]
  /** Item ids granted by the builder (one SRD starting-equipment option). */
  startingEquipment: string[]
  features: { level: number; name: string }[]
}

export interface Background {
  id: string
  name: string
  skillProficiencies: SkillId[]
  feature: string
  equipment: string[]
}

export type Item =
  | {
      kind: 'weapon'
      id: string
      name: string
      category: WeaponCategory
      damage: string
      damageType: string
      properties: WeaponProperty[]
      /** Damage die when wielded two-handed. */
      versatile?: string
      range?: string
      weight: number
    }
  | {
      kind: 'armor'
      id: string
      name: string
      category: ArmorCategory
      baseAc: number
      /** Max DEX bonus; undefined means unlimited, 0 means none. */
      dexCap?: number
      stealthDisadvantage?: boolean
      strengthReq?: number
      weight: number
    }
  | { kind: 'gear'; id: string; name: string; weight: number; description?: string }

export type WeaponProperty =
  | 'finesse' | 'light' | 'heavy' | 'reach' | 'thrown' | 'two-handed'
  | 'versatile' | 'ammunition' | 'loading' | 'ranged'

export interface InventoryEntry {
  uid: string
  itemId: string
  qty: number
  equipped: boolean
}

export type ConditionId =
  | 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled'
  | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned'
  | 'prone' | 'restrained' | 'stunned' | 'unconscious'
