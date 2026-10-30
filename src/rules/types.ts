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

/** A racial trait with limited uses, tracked on the sheet's Resources (id `race:<slug>`). */
export interface RaceUse {
  /** The trait's name, as listed in `traits`. */
  trait: string
  count: UsesCount
  recharge: RestType
  /** Character level the trait starts at (Aasimar Celestial Revelation: 3). */
  level?: number
}

/** An effect from character level `level` on (innate spells at 3rd and 5th). */
export type RaceEffect = ItemEffect & { level?: number }

/** A racial pick saved in Character.traitChoices[id]; the picked option's effects apply (Changeling Instincts, Simic Hybrid). */
export interface TraitChoice {
  id: string
  name: string
  /** Number of options to pick (default 1); several picks are saved comma-separated. */
  count?: number
  /** Character level the pick unlocks at (Simic Hybrid's second enhancement: 5). */
  level?: number
  options: { id: string; name: string; detail?: string; effects?: RaceEffect[] }[]
}

/** Rules a race or subrace adds to the sheet beyond its listed traits. */
export interface RaceRules {
  /** Book it comes from; missing for SRD and homebrew. */
  source?: string
  /** Sheet changes: senses, resistances, advantage, speeds, skill proficiencies, innate spells (kind 'spell'). */
  effects?: RaceEffect[]
  uses?: RaceUse[]
  /** Picks beyond Dragonborn's `traitChoice`, each with effects. */
  choices?: TraitChoice[]
  /** Unarmored AC: base (+ DEX when `dex`); a shield still adds (Tortle 17, Lizardfolk/Locathah 13 + DEX). */
  naturalArmor?: { base: number; dex: boolean }
  /** Languages known on top of the race's (subraces: Mark of Hospitality adds none, half-elf variants none). */
  languages?: string[]
  skillProficiencies?: SkillId[]
  /** Tools always known (Autognome, Mark of Making). Picks go in Race.toolChoices. */
  tools?: string[]
  armor?: ArmorCategory[]
  weapons?: WeaponCategory[]
  /** Specific weapon ids the race is trained with (Drow: rapier, shortsword, hand crossbow). */
  weaponIds?: string[]
  /** Unarmed strikes with a body part (Tabaxi claws, Minotaur horns): an attack row with this die + STR. */
  naturalWeapons?: { name: string; damage: string; type: string }[]
  /** Add the proficiency bonus to initiative (Harengon Hare-Trigger). */
  initiativeProficiency?: boolean
}

export interface Subrace extends RaceRules {
  id: string
  name: string
  abilityBonuses: Partial<Abilities>
  traits: string[]
  /** The subrace's scores replace the race's fixed and free ones (dragonmarked humans, Variant Human). */
  replacesBonuses?: boolean
  /** Free +1s the subrace gives (Mark of Making human: one ability other than INT). */
  freeAbilityBonuses?: { count: number; exclude: Ability[] }
  /** Race traits this subrace swaps out (Mark of Finding half-orc loses Menacing). */
  removesTraits?: string[]
  /** Skills of the player's choice; replaces the race's count (half-elf variants: 0, Variant Human: 1). */
  freeSkillChoices?: number
  /** Variant Human: one feat of the player's choice (any 2014 feat), saved as originFeatId. */
  featChoice?: boolean
  /** Extra max HP per character level (Hill Dwarf). */
  hpPerLevel?: number
  /** Extra languages of the player's choice (High Elf). */
  languageChoices?: number
  /** Set on homebrew subraces: the race they belong to. */
  parentRaceId?: string
  /** Walking speed instead of the race's (2024 Wood Elf: 35). */
  speed?: number
}

export interface Race extends RaceRules {
  id: string
  name: string
  size: Size
  /** Sizes the player picks from (Medium or Small); saved as Character.sizeChoice, `size` is the default. */
  sizeOptions?: Size[]
  speed: number
  abilityBonuses: Partial<Abilities>
  /**
   * Monsters of the Multiverse style: +2 to one ability and +1 to another, or +1 to three, picked in
   * `freeAbilityBonuses` (one entry per +1, at most +2 to one), like 2024 background bonuses.
   */
  flexibleAbilityBonuses?: boolean
  /** Number of bonuses the player assigns freely (Half-Elf: two +1s); `value` per pick, default 1 (Custom Lineage: one +2). */
  freeAbilityBonuses?: { count: number; exclude: Ability[]; value?: number }
  /** One feat of the player's choice (any 2014 feat), saved as originFeatId (Custom Lineage). */
  featChoice?: boolean
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
  traitChoice?: { id: string; name: string; options: { id: string; name: string; detail: string; effects?: RaceEffect[] }[] }
  traits: string[]
  /** Extra max HP per character level (homebrew races; SRD puts this on Hill Dwarf). */
  hpPerLevel?: number
  subraces?: Subrace[]
  /** The race can be played without picking a subrace (Human with Variant Human, Tiefling bloodlines). */
  subraceOptional?: boolean
  /** A 2014 race offered under 2024 rules (no 2024 version exists); its ability bonuses come from the background. */
  legacy?: boolean
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

/** A class feature from its level on. */
export interface ClassFeature {
  level: number
  name: string
  /** Changes to the sheet from this level on (Diamond Soul's save proficiencies, Feral Instinct's initiative advantage). */
  effects?: ItemEffect[]
  /** [class level, text] steps for what grows with the level ("d8", "CR 1", "3 attacks"); the sheet shows the latest. */
  detail?: [number, string][]
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

/**
 * A feature that picks several things: Expertise skills, an extra skill (Primal Knowledge) or languages.
 * Skill picks are saved in Character.classPicks under `<classId>.<id>`; language picks add to the language count.
 */
export interface ClassPick {
  id: string
  /** Feature name, e.g. "Expertise". */
  name: string
  level: number
  kind: 'expertise' | 'skill' | 'language'
  count: number
  /** The book's list. Missing means any skill (Expertise: any skill you're proficient in). Others only warn. */
  from?: SkillId[]
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
  features: ClassFeature[]
  /** Level-gated picks (2024: Fighting Style, Divine Order, Primal Order). Saved in Character.featureChoices. */
  choices?: ClassChoice[]
  /** Level-gated multi-picks (Expertise, Primal Knowledge, Thieves' Cant language). */
  picks?: ClassPick[]
  /** Weapon Mastery (2024): [class level, weapons] steps. */
  weaponMastery?: [number, number][]
  /** Gold in the starting kit (2024 kits list it; 2014 characters start with 15 gp). */
  startingGold?: number
  /** 2014 "take gold instead": `dice`d4 × `multiplier` gp in place of the class and background gear. */
  startingWealth?: { dice: number; multiplier: number }
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

/** How many uses a subclass feature has: a number, the proficiency bonus, the class level, or an ability modifier. */
export type UsesCount = number | 'pb' | 'level' | Ability

export interface SubclassFeature {
  level: number
  name: string
  /** What it does, for features the SRD library can't describe (other books, custom subclasses). */
  text?: string
  /** Uses tracked on the sheet's Resources: count + add, at least `min` (default 1). */
  uses?: {
    count: UsesCount; recharge: RestType; add?: number; min?: number
    /** Multiplies the count (Psionic Power: twice the proficiency bonus). */
    mult?: number
    /** [class level, uses] steps that replace a numeric count (Superiority Dice: 4, then 5 at 7, 6 at 15). */
    steps?: [number, number][]
  }
  /** Changes to the sheet from this level on: resistances, speeds, senses, proficiencies, advantage, AC... */
  effects?: ItemEffect[]
}

/**
 * A list a subclass feature picks from (maneuvers, runes, totem animals). The options are ClassOption entries
 * of the same `kind` (rules/classOptions); picks are saved in Character.classOptions.
 */
export interface SubclassPickList {
  kind: string
  /** The subclass feature that offers the list, used as its title. */
  feature: string
  subclassIds: string[]
  /** Edition the list belongs to; none means both. */
  edition?: RulesEdition
  /** [class level, total picks] steps. */
  count: [number, number][]
  /** Picks can change: one per level gained, or after a rest (2024 Hunter's Prey, Land type). */
  swap?: 'level' | 'rest'
}

/** A subclass with every mechanic the engine applies. Official subclasses and the player's custom ones share it. */
export interface SubclassData {
  classId: string
  name: string
  features: SubclassFeature[]
  /** Armor proficiencies the subclass adds (Life Domain: heavy). */
  armor?: ArmorCategory[]
  /** Weapon proficiencies the subclass adds (Hexblade: martial). */
  weapons?: WeaponCategory[]
  /** Extra max HP per level in this class (Draconic Resilience). */
  hpPerLevel?: number
  /** Unarmored AC base before DEX (Draconic Resilience: 13). */
  unarmoredBase?: number
  /** Unarmored AC is 10 + DEX + this ability (2024 Draconic Resilience: CHA). */
  unarmoredAbility?: Ability
  /** Spells always prepared (or added to the list), by class level, as spell names. */
  spells?: { level: number; names: string[] }[]
  /** Pact weapon attacks may use Charisma under 2014 rules too (Hex Warrior). */
  castingWeapon?: boolean
  /** Book it comes from, shown in the builder ("Xanathar's Guide"). SRD subclasses have none. */
  source?: string
  /** Player's own description (custom subclasses). */
  description?: string
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
  feat?: { id: string; note?: string; /** Shown until the feat itself is defined, or for a pick such as "A Dark Gift feat". */ name?: string }
  /** Gold that comes with the background's gear (2024). */
  gold?: number
  /** Homebrew: rule effects the background grants in either edition, applied like a feat's. */
  effects?: FeatEffect[]
  /** Homebrew: the author's own text, shown in the builder in place of an SRD explanation. */
  description?: string
  /** Book the background comes from; unset for the SRD. */
  source?: string
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

/** A flat bonus an item gives while worn. `attack` and `damage` apply to weapon attacks (and the unarmed strike). */
export type BonusEffectKind =
  | 'ac' | 'saves' | 'checks' | 'spellAttack' | 'spellDc' | 'speed' | 'attack' | 'damage' | 'initiative'
  | 'hp' | 'passivePerception'

export type MoveMode = 'fly' | 'swim' | 'climb' | 'burrow'
export type Sense = 'darkvision' | 'blindsight' | 'tremorsense' | 'truesight'
export type Recharge = 'short' | 'long' | 'dawn' | 'none'

/** What an advantage effect covers: one skill, one save, every save or check, initiative, weapon attacks, concentration saves. */
export type AdvantageOn = `skill:${SkillId}` | `save:${Ability}` | 'saves' | 'checks' | 'initiative' | 'attacks' | 'concentration'

export type ItemEffect =
  /**
   * `unarmored`: only without armor and shield (Bracers of Defense). `armored`: only while wearing armor (Defense style).
   * `only`: just melee or just ranged weapons (Bracers of Archery).
   */
  | { kind: BonusEffectKind; value: number; unarmored?: boolean; armored?: boolean; only?: 'melee' | 'ranged' }
  /** Score becomes this unless already higher (Gauntlets of Ogre Power: STR 19). */
  | { kind: 'abilitySet'; ability: Ability; value: number }
  /** Adds to the score, up to `max` (Ioun Stone of Agility: DEX +2, max 20). */
  | { kind: 'ability'; ability: Ability; value: number; max?: number }
  /** Bonus to one saving throw or one skill. */
  | { kind: 'save'; ability: Ability; value: number }
  | { kind: 'skill'; skill: SkillId; value: number }
  /** Proficiency in a save or skill; `expertise` doubles the skill's proficiency bonus. */
  | { kind: 'saveProficiency'; ability: Ability }
  | { kind: 'skillProficiency'; skill: SkillId; expertise?: boolean }
  /** Advantage. With `when` (e.g. "against spells") it is situational: shown, not rolled automatically. */
  | { kind: 'advantage'; on: AdvantageOn; when?: string }
  /** Half damage (resistance) or none (immunity) from a damage type. */
  | { kind: 'resistance' | 'immunity'; damage: string }
  | { kind: 'conditionImmunity'; condition: ConditionId }
  /** A flying, swimming, climbing or burrowing speed; 0 means equal to your walking speed (Winged Boots). */
  | { kind: 'moveSpeed'; mode: MoveMode; value: number }
  /** A sense with its range in feet (Goggles of Night: darkvision 60). */
  | { kind: 'sense'; sense: Sense; value: number }
  /** Extra spell slots of one level, back on a long rest. */
  | { kind: 'spellSlot'; level: number; value: number }
  /** Extra warlock pact slots, back on a short rest. */
  | { kind: 'pactSlot'; value: number }
  /** Charges the item spends, tracked on the sheet's Resources. `regain`: dice regained at dawn, blank for all. */
  | { kind: 'charges'; value: number; recharge: Recharge; regain?: string }
  /** A spell the item lets you cast, with how (e.g. "1 charge", "once a day"). */
  | { kind: 'spell'; spell: string; note?: string }

export type ConditionId =
  | 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled'
  | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned'
  | 'prone' | 'restrained' | 'stunned' | 'unconscious'
