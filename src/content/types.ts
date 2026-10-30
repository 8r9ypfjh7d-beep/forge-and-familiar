// Data model of the content library: every spell, item, class, race, feat, background, condition and monster.
// Pure types, generated JSON follows them. The ingest script (scripts/content) and the app share this file.

/** Rules edition. 2014 is the SRD 5.1, 2024 the SRD 5.2. Same-named entries differ between them. */
export type Edition = '2014' | '2024'

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type Abilities = Record<Ability, number>

export const CONTENT_KINDS = [
  'spells', 'equipment', 'magic-items', 'classes', 'subclasses', 'features',
  'races', 'subraces', 'traits', 'feats', 'backgrounds', 'conditions', 'monsters',
  'languages', 'proficiencies', 'glossary',
] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

/** Where entries come from. SRD sources ship with the app; packs add more at runtime. */
export interface SourceInfo {
  id: string
  title: string
  edition: Edition
  /** SPDX-style id, e.g. CC-BY-4.0. */
  license: string
  /** Must stay visible wherever this source's text is shown. */
  attribution: string
}

/** A pointer to another entry of the same source: its id plus the name to show without loading it. */
export interface Ref {
  id: string
  name: string
}

/** Fields every entry has. `key()` in index.ts makes `${source}:${kind}:${id}` unique across sources. */
export interface EntryBase {
  id: string
  name: string
  source: string
  edition: Edition
}

export interface Money {
  qty: number
  unit: 'cp' | 'sp' | 'ep' | 'gp' | 'pp'
}

/**
 * A "choose N of these" pick, used for skills, gear, languages, ability bonuses and prerequisites.
 * Options are a tagged union so the builder can render each kind of pick.
 */
export interface Choice {
  choose: number
  description?: string
  options: ChoiceOption[]
}

export type ChoiceOption =
  | { kind: 'ref'; ref: Ref; count: number }
  | { kind: 'all'; options: ChoiceOption[] }
  | { kind: 'category'; category: Ref }
  | { kind: 'money'; money: Money }
  | { kind: 'ability'; ability: Ability; amount: number }
  | { kind: 'text'; text: string }
  | { kind: 'choice'; choice: Choice }
  /** A kind of option this model does not cover yet; `raw` keeps the upstream JSON. */
  | { kind: 'other'; raw: unknown }

export type SpellSchool =
  | 'abjuration' | 'conjuration' | 'divination' | 'enchantment'
  | 'evocation' | 'illusion' | 'necromancy' | 'transmutation'

export interface Spell extends EntryBase {
  /** 0 is a cantrip. */
  level: number
  school: SpellSchool
  castingTime: string
  range: string
  components: { v: boolean; s: boolean; m: boolean; material?: string }
  duration: string
  concentration: boolean
  ritual: boolean
  /** Class ids whose spell list has it. */
  classes: string[]
  /** Subclass ids that add it (domain and oath spells). */
  subclasses: string[]
  /** Markdown. */
  description: string
  higherLevels?: string
  attack?: 'melee' | 'ranged'
  save?: { ability: Ability; onSuccess: 'none' | 'half' | 'other' }
  damage?: {
    type?: string
    /** Slot level → dice, for leveled spells. */
    bySlotLevel?: Record<number, string>
    /** Character level → dice, for cantrips. */
    byCharacterLevel?: Record<number, string>
  }
  /** Slot level → healing, "MOD" is the spellcasting modifier. */
  healBySlotLevel?: Record<number, string>
  area?: { shape: string; size: number }
  /** Book spells (`src/content/books`): the book's code, e.g. XGE. */
  book?: string
  /** Book spells: our own Hebrew summary next to the English one in `description`. */
  descriptionHe?: string
}

export type EquipmentType = 'weapon' | 'armor' | 'gear' | 'tool' | 'mount' | 'vehicle'

export interface Weapon {
  category: 'simple' | 'martial'
  range: 'melee' | 'ranged'
  damage?: { dice: string; type: string }
  versatileDamage?: string
  /** Weapon property ids, e.g. finesse, two-handed. */
  properties: string[]
  /** Feet. Melee reach; ranges are set for ranged and thrown weapons. */
  reach?: number
  normalRange?: number
  longRange?: number
  ammunition?: string
  /** 2024 weapon mastery id. */
  mastery?: string
}

export interface Armor {
  category: 'light' | 'medium' | 'heavy' | 'shield'
  baseAc: number
  dexBonus: boolean
  /** Max DEX bonus; absent means no cap. */
  maxDexBonus?: number
  strMinimum?: number
  stealthDisadvantage: boolean
  donTime?: string
  doffTime?: string
}

export interface Equipment extends EntryBase {
  type: EquipmentType
  /** Equipment category ids, broadest last, e.g. ["martial-melee-weapons", "weapons"]. */
  categories: string[]
  cost?: Money
  /** Pounds. */
  weight?: number
  description?: string
  weapon?: Weapon
  armor?: Armor
  /** Pack contents. */
  contents?: { item: Ref; qty: number }[]
  /** Units sold for the cost, e.g. 20 arrows. */
  bundleSize?: number
  /** Tool ability and craftable items (2024). */
  tool?: { ability?: Ability; crafts: Ref[] }
  speed?: string
  capacity?: string
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact' | 'varies'

export interface MagicItem extends EntryBase {
  /** Equipment category id: armor, weapon, wondrous-items, potion, ring… */
  category: string
  rarity: Rarity
  /** Upstream wording when it says more than one rarity, e.g. "Uncommon (+1), Rare (+2)…". */
  rarityText?: string
  /** true, or the requirement text ("by a cleric"). */
  attunement: boolean | string
  description: string
  /** Set on "+1 Weapon"-style parents; children carry `variantOf`. */
  variants: Ref[]
  variantOf?: string
}

export interface ClassLevel {
  level: number
  proficiencyBonus: number
  /** Feature ids gained at this level. */
  features: string[]
  /** 2014 marks ASI levels with a running count; true on levels that add one. */
  abilityScoreImprovement: boolean
  spellcasting?: {
    cantripsKnown?: number
    spellsKnown?: number
    preparedSpells?: number
    /** Index 0 is level-1 slots. */
    slots: number[]
  }
  /** Per-class numbers: rage_count, ki_points, sneak_attack… kept as upstream names. */
  classSpecific: Record<string, unknown>
}

export interface CharacterClass extends EntryBase {
  hitDie: number
  primaryAbilities: Ability[]
  savingThrows: Ability[]
  /** Proficiency ids (armor, weapons, tools). Saving throws are in `savingThrows`. */
  proficiencies: Ref[]
  proficiencyChoices: Choice[]
  startingEquipment: { item: Ref; qty: number }[]
  startingEquipmentChoices: Choice[]
  multiclass: {
    /** All must be met, unless `anyOf` (Fighter: STR or DEX 13). */
    prerequisites: { ability: Ability; minimum: number }[]
    anyOf: boolean
    proficiencies: Ref[]
    proficiencyChoices: Choice[]
  }
  spellcasting?: { ability: Ability; fromLevel: number; info: { name: string; description: string }[] }
  subclasses: Ref[]
  levels: ClassLevel[]
}

export interface Subclass extends EntryBase {
  classId: string
  /** What the class calls it (2014), e.g. "Divine Domain". */
  flavor?: string
  /** One-line summary (2024). */
  summary?: string
  description: string
  /** Feature ids with their level. */
  features: { level: number; feature: Ref }[]
  /** Always-prepared spells, by class level. */
  spells: { level: number; spell: Ref }[]
}

export interface Feature extends EntryBase {
  classId: string
  subclassId?: string
  level: number
  description: string
  /** Set on options of a feature, e.g. one Fighting Style. */
  parentId?: string
  /** Options the player picks from (fighting styles, expertise, land types). */
  choices: Choice[]
  /** Features this one unlocks a pick of (Eldritch Invocations). */
  subfeatures: Ref[]
}

export type Size = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'

/** A race (2014) or species (2024). */
export interface Race extends EntryBase {
  creatureType?: string
  /** More than one when the player picks (2024 Human, Tiefling). */
  sizes: Size[]
  speed: number
  /** Fixed bonuses. 2024 species have none; backgrounds give them. */
  abilityBonuses: Partial<Abilities>
  abilityBonusChoices: Choice[]
  languages: Ref[]
  languageChoices: Choice[]
  traits: Ref[]
  subraces: Ref[]
  /** Flavor text (2014). */
  age?: string
  alignment?: string
  sizeDescription?: string
  languageDescription?: string
}

/** A subrace (2014) or lineage/ancestry (2024 subspecies). */
export interface Subrace extends EntryBase {
  raceId: string
  description?: string
  abilityBonuses: Partial<Abilities>
  traits: Ref[]
  damageType?: string
}

export interface Trait extends EntryBase {
  description: string
  races: string[]
  subraces: string[]
  /** Proficiency ids granted outright. */
  proficiencies: Ref[]
  choices: Choice[]
  /** Spells the trait grants (2024). */
  spells: { spell: Ref; uses?: string; recovery?: string }[]
  parentId?: string
  damageType?: string
  /** Sets walking speed (2024 Wood Elf). */
  speed?: number
}

export interface Feat extends EntryBase {
  /** 2024 feat category. */
  category?: 'origin' | 'general' | 'fighting-style' | 'epic-boon'
  prerequisites: {
    abilities: { ability: Ability; minimum: number }[]
    /** One ability minimum is enough (2024 "Strength or Dexterity 13+"). */
    anyAbility: boolean
    minimumLevel?: number
    feature?: string
    /** Free-text prerequisite (homebrew). */
    text?: string
  }
  repeatable: boolean
  description: string
}

export interface Background extends EntryBase {
  /** Abilities the background may raise (2024). */
  abilityScores: Ability[]
  /** Origin feat (2024). */
  feat?: Ref & { note?: string }
  proficiencies: Ref[]
  proficiencyChoices: Choice[]
  languageChoices: Choice[]
  startingEquipment: { item: Ref; qty: number }[]
  startingEquipmentChoices: Choice[]
  startingGold?: Money
  feature?: { name: string; description: string }
  personality?: { traits: Choice; ideals: Choice; bonds: Choice; flaws: Choice }
}

export interface Condition extends EntryBase {
  description: string
}

export interface MonsterAction {
  name: string
  description: string
  /** Book monsters: our own Hebrew summary next to the English one in `description`. */
  descriptionHe?: string
  attackBonus?: number
  /** Melee reach in feet, when the text says so. */
  reach?: number
  /** Ranged attack range in feet. */
  range?: { normal: number; long?: number }
  damage: { dice: string; type: string }[]
  /** Alternatives, e.g. lightning or thunder: pick one group. */
  damageChoice?: { dice: string; type: string }[]
  save?: { ability: Ability; dc: number; onSuccess: string }
  usage?:
    | { type: 'per day'; times: number; timesInLair?: number }
    | { type: 'recharge'; dice: string; minimum: number }
    | { type: 'per rest'; rests: string[] }
}

/** A stat block's spellcasting, structured so a sheet can offer Cast buttons; the trait text stays for display. */
export interface MonsterSpellcasting {
  ability: Ability
  saveDc?: number
  attackBonus?: number
  /** "At Will", "1/Day Each", "3rd level (3 slots)"… with library spell ids, or names when the library lacks them. */
  groups: { label: string; spells: string[] }[]
  /** "requires no material components", caster level, or the class whose list it uses. */
  note?: string
}

export interface Monster extends EntryBase {
  /** Usually one; some 2024 stat blocks are "Medium or Small". */
  sizes: Size[]
  type: string
  subtype?: string
  alignment: string
  armorClass: { value: number; type?: string; note?: string }[]
  hitPoints: number
  hitDice: string
  hitPointsRoll: string
  /** walk, fly, swim, climb, burrow → "30 ft.", hover → true. */
  speed: Record<string, string | boolean>
  abilities: Abilities
  savingThrows: Partial<Record<Ability, number>>
  /** Skill id → bonus. */
  skills: Record<string, number>
  damageVulnerabilities: string[]
  damageResistances: string[]
  damageImmunities: string[]
  conditionImmunities: string[]
  senses: Record<string, string | number>
  languages: string
  challengeRating: number
  xp: number
  xpInLair?: number
  proficiencyBonus: number
  traits: MonsterAction[]
  actions: MonsterAction[]
  bonusActions: MonsterAction[]
  reactions: MonsterAction[]
  legendaryActions: MonsterAction[]
  /** Other stat blocks of the same creature (vampire bat form). */
  forms: Ref[]
  description?: string
  // ---- Optional fields, filled by book monsters (src/content/books/monsters), homebrew packs and NPC sheets ----
  /** Book monsters: the book's code, e.g. MM, XMM, MPMM (`BOOK_TITLES`). */
  book?: string
  /** Book and pack monsters: Hebrew name. SRD names live in src/i18n/locales/monsters.he.ts instead. */
  nameHe?: string
  /** Book monsters: our own Hebrew lore summary. */
  descriptionHe?: string
  /** 2024 stat blocks print an initiative bonus; absent means the DEX modifier. */
  initiative?: number
  /** 2024 "Gear" line: item names. */
  gear?: string[]
  /** 2024 stat block lines. */
  habitat?: string[]
  treasure?: string[]
  /** 2014 Monster Manual environment tags (arctic, underdark…). */
  environments?: string[]
  /** Descriptive tags: shapechanger, titan, any race, npc… */
  tags?: string[]
  /** Legendary action count per round and Legendary Resistance uses, so a tracker can count them. */
  legendary?: { actions: number; resistance?: number; description?: string }
  lairActions?: MonsterAction[]
  /** Regional effects as a short summary. */
  regionalEffects?: string
  spellcasting?: MonsterSpellcasting
}

export interface Language extends EntryBase {
  type?: 'standard' | 'exotic' | 'rare'
  script?: string
  speakers: string[]
  description?: string
}

export interface Proficiency extends EntryBase {
  /** Armor, Weapons, Artisan's Tools, Skills, Saving Throws… */
  type: string
  /** The skill, equipment or category it points at. */
  reference?: Ref & { kind: string }
  classes: string[]
  races: string[]
  backgrounds: string[]
}

/** Short rules terms with a description: skills, abilities, damage types, schools, weapon properties and masteries, alignments. */
export interface GlossaryEntry extends EntryBase {
  group: 'ability' | 'skill' | 'alignment' | 'damage-type' | 'magic-school' | 'weapon-property' | 'weapon-mastery'
  description: string
  /** Skill → its ability. */
  ability?: Ability
  abbreviation?: string
}

export interface ContentEntryByKind {
  spells: Spell
  equipment: Equipment
  'magic-items': MagicItem
  classes: CharacterClass
  subclasses: Subclass
  features: Feature
  races: Race
  subraces: Subrace
  traits: Trait
  feats: Feat
  backgrounds: Background
  conditions: Condition
  monsters: Monster
  languages: Language
  proficiencies: Proficiency
  glossary: GlossaryEntry
}

export type ContentEntry = ContentEntryByKind[ContentKind]

export const CONTENT_FORMAT = 'ff-content'
export const CONTENT_VERSION = 1

/** One generated file: all entries of one kind from one source. */
export interface ContentFile<K extends ContentKind = ContentKind> {
  format: typeof CONTENT_FORMAT
  version: number
  source: SourceInfo
  kind: K
  entries: ContentEntryByKind[K][]
}

/** `manifest.json` next to the generated files. */
export interface ContentManifest {
  format: typeof CONTENT_FORMAT
  version: number
  source: SourceInfo
  upstream: { repo: string; ref: string; path: string }
  generatedAt: string
  counts: Partial<Record<ContentKind, number>>
}

/** A pack of extra content loaded at runtime (homebrew, or a file the player imports). Same shape as the generated files. */
export interface ContentPack {
  format: typeof CONTENT_FORMAT
  version: number
  source: SourceInfo
  entries: Partial<{ [K in ContentKind]: ContentEntryByKind[K][] }>
}
