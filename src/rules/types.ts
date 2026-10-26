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

/** Rules edition: '2014' is SRD 5.1, '2024' is SRD 5.2. */
export type RulesEdition = '2014' | '2024'

export interface Subrace {
  id: string
  name: string
  abilityBonuses: Partial<Abilities>
  traits: string[]
  /** Extra max HP per character level (Hill Dwarf). */
  hpPerLevel?: number
  /** Extra languages of the player's choice (High Elf). */
  languageChoices?: number
  /** Set on homebrew subraces: the race they belong to. */
  parentRaceId?: string
  /** Walking speed instead of the race's (2024 Wood Elf: 35). */
  speed?: number
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
  /** Number of skills of the player's choice (Half-Elf, 2024 Human and Elf). */
  freeSkillChoices?: number
  /** 2024 Human (Versatile): the player picks an Origin feat. */
  originFeatChoice?: boolean
  /** Languages every member knows. Choices are counted in languageChoices. */
  languages: string[]
  /** Extra languages of the player's choice (Human, Half-Elf). */
  languageChoices?: number
  /** Tool proficiency picks (Dwarf: one artisan's tool from a short list). */
  toolChoices?: { count: number; from: string[] }
  /** A trait with named options the player picks from (Dragonborn ancestry). */
  traitChoice?: { id: string; name: string; options: { id: string; name: string; detail: string }[] }
  traits: string[]
  /** Extra max HP per character level (homebrew races; SRD puts this on Hill Dwarf). */
  hpPerLevel?: number
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

/** A pick a class makes at a level that changes the sheet: Fighting Style, Divine Order, Primal Order. */
export interface ClassChoice {
  id: string
  name: string
  level: number
  options: {
    id: string
    name: string
    detail: string
    /** Fighting Style options are feats; their effects apply through the feat. */
    featId?: string
    armor?: ArmorCategory[]
    weapons?: WeaponCategory[]
  }[]
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
  /** Item ids always granted by the builder. */
  startingEquipment: string[]
  /** SRD "(a) or (b)" starting equipment choices; each option adds its items. */
  equipmentChoices?: EquipmentChoice[]
  /** Tools the class is always proficient with. */
  toolProficiencies?: string[]
  /** Tool proficiency picks (Bard instruments, Monk tool or instrument). */
  toolChoices?: { count: number; from: string[] }
  /** Class level at which the subclass is chosen. */
  subclassLevel: number
  /** What the class calls its subclass, e.g. "Divine Domain". */
  subclassTitle: string
  /** Class levels with an Ability Score Improvement (or a feat). */
  asiLevels: number[]
  features: { level: number; name: string }[]
  /** Level-gated picks (2024: Fighting Style, Divine Order, Primal Order). Saved in Character.featureChoices. */
  choices?: ClassChoice[]
  /** Weapon Mastery (2024): [class level, weapons] steps. */
  weaponMastery?: [number, number][]
  /** Gold in the starting kit (2024 kits list it; 2014 characters start with 15 gp). */
  startingGold?: number
}

/** One starting-equipment choice. An option lists item ids; `any:<filter>` asks the player for one item. */
export interface EquipmentChoice {
  /** `gold` is the coin that comes with the option (2024 kits). */
  options: { items: string[]; gold?: number }[]
}

export interface Subclass {
  id: string
  classId: string
  name: string
  features: { level: number; name: string }[]
}

/** Effects a feat applies to the sheet. Shared with homebrew feats. */
export type FeatEffect =
  | { kind: 'ability'; ability: Ability; amount: number }
  | { kind: 'skill'; skill: SkillId }
  | { kind: 'hpPerLevel'; amount: number }
  | { kind: 'speed'; amount: number }
  | { kind: 'initiative'; amount: number }
  | { kind: 'ac'; amount: number }
  /** Adds the proficiency bonus to initiative (2024 Alert). */
  | { kind: 'initiativeProficiency' }
  /** Extra skill picks of any skill (2024 Skilled). */
  | { kind: 'skillPicks'; count: number }
  /** +1 to one ability the player picks from `from`, up to `max` (2024 Grappler, Epic Boons). */
  | { kind: 'abilityChoice'; from: Ability[]; max: number }
  /** Bonus to attack rolls with ranged weapons (Archery). */
  | { kind: 'rangedAttack'; amount: number }
  /** AC bonus while wearing armor (Defense). */
  | { kind: 'armoredAc'; amount: number }

/** 2024 feat categories. 2014 feats have none. */
export type FeatCategory = 'origin' | 'general' | 'fighting-style' | 'epic-boon'

export interface Feat {
  id: string
  name: string
  prerequisite?: string
  description: string
  effects: FeatEffect[]
  category?: FeatCategory
  /** Lowest character level that may take it (2024 general feats 4, Epic Boons 19). */
  minLevel?: number
}

export interface Background {
  id: string
  name: string
  skillProficiencies: SkillId[]
  toolProficiencies?: string[]
  /** Fixed languages the background teaches. */
  languages?: string[]
  /** Extra languages of the player's choice. */
  languageChoices?: number
  /** Tool proficiency picks (2024 Soldier: one gaming set). */
  toolChoices?: { count: number; from: string[] }
  feature: string
  equipment: string[]
  /** 2024: the three abilities the background raises (+2/+1 or +1/+1/+1). */
  abilityScores?: Ability[]
  /** 2024: the Origin feat the background grants, with a note such as "Cleric" for Magic Initiate. */
  feat?: { id: string; note?: string }
  /** Gold that comes with the background's gear (2024). */
  gold?: number
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
  /** The item itself when the engine's ITEMS don't have it: library items (src/content) and custom story items. */
  item?: Item
  /** The player's name for it ("Soulreaver"); the item's own name otherwise. */
  name?: string
  notes?: string
  /** +1 to +3 magic weapon or armor: added to attack and damage rolls, or to AC. */
  magicBonus?: number
  /** Warlock pact weapon: always proficient; in 2024 rules it may use Charisma for attack and damage. */
  pact?: boolean
  /** Extra damage on every hit, e.g. "1d6 fire" (Flame Tongue). */
  extraDamage?: string
  /** What the item does to the character's numbers while equipped. */
  effects?: ItemEffect[]
}

/** A bonus an item gives while worn: AC, saves, ability checks, spell attack and DC, walking speed. */
/** `attack` and `damage` apply to weapon attacks (and the unarmed strike). */
export type BonusEffectKind = 'ac' | 'saves' | 'checks' | 'spellAttack' | 'spellDc' | 'speed' | 'attack' | 'damage' | 'initiative'

export type ItemEffect =
  /** `unarmored`: only without armor and shield (Bracers of Defense). */
  | { kind: BonusEffectKind; value: number; unarmored?: boolean }
  /** Score becomes this unless already higher (Gauntlets of Ogre Power: STR 19). */
  | { kind: 'abilitySet'; ability: Ability; value: number }
  /** Adds to the score, up to `max` (Ioun Stone of Agility: DEX +2, max 20). */
  | { kind: 'ability'; ability: Ability; value: number; max?: number }

export type ConditionId =
  | 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled'
  | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned'
  | 'prone' | 'restrained' | 'stunned' | 'unconscious'
