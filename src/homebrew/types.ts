// Homebrew content: spells, items, feats, races, subclasses, backgrounds class options and classes a group writes themselves, grouped into shareable packs.
import type { ClassOption, HOMEBREW_OPTION_KINDS } from '../rules/classOptions'
import type { Abilities, Ability, ArmorCategory, CasterType, ClassFeature, ClassSpellcasting, FeatEffect, Item, Size, SkillId, WeaponCategory } from '../rules/types'

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

export const BACKGROUND_EDITIONS = ['both', '2014', '2024'] as const
export type BackgroundEditions = (typeof BACKGROUND_EDITIONS)[number]

/** A background in either edition: proficiencies, gear, a story feature, 2024 ability options and Origin feat, and effects. */
export interface HomebrewBackground {
  id: string
  name: string
  /** Which rules editions list it in the builder. */
  editions: BackgroundEditions
  skillProficiencies: SkillId[]
  /** Fixed tool proficiencies. */
  tools: string[]
  /** Tools the player picks; from an empty list means any tool. */
  toolChoices: number
  toolChoiceFrom: string[]
  languages: string[]
  languageChoices: number
  /** Item ids (SRD or homebrew) the character starts with. */
  equipment: string[]
  gold: number
  /** Feature name, e.g. "Ship's Passage". */
  feature: string
  featureText?: string
  /** 2024: the three abilities the background suggests for +2/+1 or +1/+1/+1. */
  abilityScores: Ability[]
  /** 2024: Origin feat id (SRD or homebrew) and an optional note such as "Wizard". */
  originFeatId?: string
  originFeatNote?: string
  /** Rule effects in both editions (an ability score, a skill, speed, AC...). */
  effects: FeatEffect[]
  description?: string
}
export type HomebrewOptionKind = (typeof HOMEBREW_OPTION_KINDS)[number]

/** An invocation, metamagic, maneuver, fighting style or infusion. Registered with rules/classOptions, so the matching picker offers it. */
export type HomebrewClassOption = ClassOption & { kind: HomebrewOptionKind; text: string; classIds: string[] }

export const HIT_DICE = [6, 8, 10, 12] as const

/** A whole class: proficiencies, casting, features by level with uses and sheet effects, and where its subclass starts. */
export interface HomebrewClass {
  id: string
  name: string
  hitDie: number
  primary: Ability[]
  savingThrows: Ability[]
  skillChoices: { count: number; from: SkillId[] }
  armor: ArmorCategory[]
  weapons: WeaponCategory[]
  /** Tools it is always proficient with (free text). */
  tools: string[]
  caster: CasterType
  spellAbility?: Ability
  /** Set for casters: which list, known or prepared, cantrips and spells known by level. */
  spellcasting?: ClassSpellcasting
  /** Unarmored AC is 10 + DEX + this ability. */
  unarmoredDefense?: Ability
  subclassLevel: number
  subclassTitle: string
  asiLevels: number[]
  features: ClassFeature[]
  /** Multiclassing into it: ability minimums (all must be met) and the proficiencies it then grants. */
  multiclass: { prereq: Partial<Abilities>; armor: ArmorCategory[]; weapons: WeaponCategory[] }
  startingGold?: number
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
  backgrounds: HomebrewBackground[]
  /** Invocations, metamagic, maneuvers, fighting styles, infusions. Older packs load with none. */
  classOptions: HomebrewClassOption[]
  classes: HomebrewClass[]
  /** Author's change history, only in downloaded pack files. Validated by src/history, never stored in the library. */
  history?: unknown[]
}

export type ContentKind = 'spells' | 'items' | 'feats' | 'races' | 'subclasses' | 'backgrounds' | 'classOptions' | 'classes'


export type HomebrewEntry = HomebrewSpell | HomebrewItem | HomebrewFeat | HomebrewRace | HomebrewSubclass | HomebrewBackground | HomebrewClassOption | HomebrewClass
