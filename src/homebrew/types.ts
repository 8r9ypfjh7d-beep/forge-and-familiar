// Homebrew content: spells, items, feats, races, subclasses, backgrounds, class options, classes, languages and tools a group writes themselves, grouped into shareable packs.
import type { ClassOption, HOMEBREW_OPTION_KINDS } from '../rules/classOptions'
import type {
  Abilities, Ability, ArmorCategory, CasterType, ClassFeature, ClassSpellcasting, Feat, FeatEffect, Item, ItemEffect, RulesEdition, Size, SkillId, SubclassFeature, WeaponCategory,
} from '../rules/types'

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

/** A homebrew feat: the same mechanics as an official one (abilities, uses, training, sheet effects). */
export interface HomebrewFeat {
  id: string
  name: string
  prerequisite?: string
  description: string
  effects: FeatEffect[]
  stats?: ItemEffect[]
  uses?: Feat['uses']
  armor?: ArmorCategory[]
  weapons?: WeaponCategory[]
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
  /** Made for one edition only ('2024' species take ability bonuses from the background); missing means both. */
  edition?: RulesEdition
  /** Extra sizes the player may pick instead of `size` (2024 style "Small or Medium"). */
  sizeOptions?: Size[]
  /** Sheet changes: senses, resistances, immunities, speeds, advantage, innate spells, uses per rest... */
  effects?: ItemEffect[]
  /** Tools every member knows, and free tool picks of any tool. */
  tools?: string[]
  toolChoices?: number
  armor?: ArmorCategory[]
  weapons?: WeaponCategory[]
  /** Natural armor: unarmored AC is this + DEX (0 or missing: none). */
  naturalArmor?: number
  /** A named pick (lineage, ancestry, heritage); each option can change the sheet. */
  choice?: { name: string; options: { name: string; detail: string; effects?: ItemEffect[] }[] }
}

export const LANGUAGE_KINDS = ['standard', 'rare', 'secret'] as const
export type LanguageKind = (typeof LANGUAGE_KINDS)[number]

/** A language the group invented; characters can pick it wherever they pick a language. */
export interface HomebrewLanguage {
  id: string
  name: string
  kind: LanguageKind
  script?: string
  speakers?: string
  description?: string
}

export const TOOL_KINDS = ['artisan', 'gaming', 'instrument', 'other'] as const
export type ToolKind = (typeof TOOL_KINDS)[number]

/** A tool, kit, game or instrument the group invented; characters can pick it wherever they pick a tool. */
export interface HomebrewTool {
  id: string
  name: string
  kind: ToolKind
  /** The ability its checks usually use. */
  ability?: Ability
  description?: string
}

/** A subclass with everything the builder's own Custom subclass has: features with text, uses and effects, spells and proficiencies. */
export interface HomebrewSubclass {
  id: string
  name: string
  classId: string
  features: SubclassFeature[]
  /** Extra armor proficiencies. */
  armor: ArmorCategory[]
  weapons?: WeaponCategory[]
  /** Extra max HP per level in this class. */
  hpPerLevel?: number
  /** Unarmored AC is 10 + DEX + this ability. */
  unarmoredAbility?: Ability
  /** Spells always prepared, by class level. */
  spells?: { level: number; names: string[] }[]
  /** Warlock pact weapon attacks may use Charisma. */
  castingWeapon?: boolean
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
  /** Missing in packs saved before languages and tools existed; sanitizePack fills them in. */
  languages: HomebrewLanguage[]
  tools: HomebrewTool[]
  /** Author's change history, only in downloaded pack files. Validated by src/history, never stored in the library. */
  history?: unknown[]
}

export type ContentKind = 'spells' | 'items' | 'feats' | 'races' | 'subclasses' | 'backgrounds' | 'classOptions' | 'classes' | 'languages' | 'tools'

export type HomebrewEntry =
  | HomebrewSpell | HomebrewItem | HomebrewFeat | HomebrewRace | HomebrewSubclass | HomebrewBackground | HomebrewClassOption | HomebrewClass
  | HomebrewLanguage | HomebrewTool
