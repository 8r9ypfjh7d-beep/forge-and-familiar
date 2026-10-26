// Homebrew content: spells, items and feats a group writes themselves, grouped into shareable packs.
import type { Abilities, Ability, ArmorCategory, FeatEffect, Item, Size, SkillId } from '../rules/types'

export type { FeatEffect }

export const SPELL_SCHOOLS = [
  'Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation',
] as const
export type SpellSchool = (typeof SPELL_SCHOOLS)[number]

export const RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'] as const
export type Rarity = (typeof RARITIES)[number]

export interface HomebrewSpell {
  id: string
  name: string
  /** 0 is a cantrip. */
  level: number
  school: SpellSchool
  castingTime: string
  range: string
  components: { v: boolean; s: boolean; m: boolean; material?: string }
  duration: string
  concentration: boolean
  ritual: boolean
  /** Class ids that can learn it (SRD ids or free text). */
  classes: string[]
  description: string
  higherLevels?: string
  /** Optional roll the sheet and dice can use, e.g. "3d6". */
  damage?: string
  damageType?: string
  save?: Ability
}

export interface HomebrewFeat {
  id: string
  name: string
  prerequisite?: string
  description: string
  effects: FeatEffect[]
}

/** A race, or a subrace when parentRaceId is set (then size, speed and languages come from the parent). */
export interface HomebrewRace {
  id: string
  name: string
  /** SRD or homebrew race id this is a subrace of. */
  parentRaceId?: string
  size: Size
  speed: number
  abilityBonuses: Partial<Abilities>
  /** Free +1s the player assigns (any ability). */
  freeAbilityBonuses: number
  skillProficiencies: SkillId[]
  freeSkillChoices: number
  languages: string[]
  languageChoices: number
  traits: string[]
  hpPerLevel: number
  description?: string
}

export interface HomebrewSubclass {
  id: string
  name: string
  classId: string
  features: { level: number; name: string }[]
  /** Extra armor proficiencies. */
  armor: ArmorCategory[]
  description?: string
}

/** A rules-engine Item plus flavour. Weapons and armor work in derive() once registered. */
export type HomebrewItem = Item & { description?: string; rarity?: Rarity }

export const PACK_FORMAT = 'ff-homebrew'
export const PACK_VERSION = 1

export interface HomebrewPack {
  format: typeof PACK_FORMAT
  version: typeof PACK_VERSION
  /** Stable across devices so shared copies update in place and item ids keep resolving. */
  id: string
  name: string
  description: string
  /** UserProfile.id and display name of whoever made it. */
  authorId: string
  authorName: string
  updatedAt: string
  spells: HomebrewSpell[]
  items: HomebrewItem[]
  feats: HomebrewFeat[]
  races: HomebrewRace[]
  subclasses: HomebrewSubclass[]
  /** Author's change history, only in downloaded pack files. Validated by src/history, never stored in the library. */
  history?: unknown[]
}

export type ContentKind = 'spells' | 'items' | 'feats' | 'races' | 'subclasses'

export type HomebrewEntry = HomebrewSpell | HomebrewItem | HomebrewFeat | HomebrewRace | HomebrewSubclass
