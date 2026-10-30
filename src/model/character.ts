// Saved character shape, shared by the builder (creates it) and the live sheet (plays it).
// Everything not stored here (max HP, AC, modifiers, slots, resource maxima) is derived by src/rules.
import type { QuickCastEntry } from '../quickcast/types'
import type { ClassOptionPick } from '../rules/classOptions'
import type { Abilities, Ability, ConditionId, InventoryEntry, ItemEffect, Size, SkillId, SubclassData } from '../rules/types'

export type AbilityMethod = 'standard' | 'pointBuy' | 'rolled' | 'manual'
export type HitDie = 'd6' | 'd8' | 'd10' | 'd12'

export interface ClassLevel {
  classId: string
  level: number
  subclassId?: string
}

/** Runtime play state. Owned and mutated by the live sheet. */
export interface CharacterState {
  currentHp: number
  tempHp: number
  deathSaves: { successes: number; failures: number }
  hitDiceSpent: Partial<Record<HitDie, number>>
  /** Used slots, index 0 = 1st level, length 9. */
  spellSlotsUsed: number[]
  pactSlotsUsed: number
  resources: Record<string, { used: number }>
  conditions: ConditionId[]
  /** Player-made trackers (arrows, item charges). */
  counters?: {
    id: string; label: string; max: number; used: number; recharge: 'short' | 'long' | 'dawn' | 'none'
    /** Dawn trackers only: dice regained each dawn, e.g. "1d6+1". Blank means all of them. */
    regain?: string
  }[]
  /** Ammo and food countdowns (src/supplies). Counts themselves are inventory quantities. */
  supplies?: {
    /** Pieces fired per ammo item id since the last battlefield search. */
    ammoSpent?: Record<string, number>
    /** Long rests in a row taken without eating. */
    daysWithoutFood?: number
  }
}

/** The PHB "Customizing a Background" rule: used when backgroundId is 'custom'. */
/** Each map is book proficiency → its replacement of the same kind. Missing or empty keeps the book's. */
export interface OriginSwaps {
  skills?: Partial<Record<SkillId, SkillId>>
  languages?: Record<string, string>
  /** Weapon item ids. */
  weapons?: Record<string, string>
}

export interface CustomBackground {
  name: string
  feature: string
  /** Exactly two skills. */
  skills: SkillId[]
  /** Tools and languages together total two. */
  tools: string[]
  languages: string[]
}

/** One Ability Score Improvement: +2/+1+1 to abilities, or a feat instead. */
export interface Improvement {
  classId: string
  /** Class level that granted it. */
  level: number
  abilities?: Partial<Abilities>
  featId?: string
  /** The ability a feat with a +1 choice raises (2024 Grappler, Epic Boons). */
  featAbility?: Ability
}

/** A spell the character knows or has prepared, from the content library (src/content). */
export interface KnownSpell {
  /** Library spell id, e.g. "fireball". The same id names the spell in both rules editions. */
  id: string
  /** The class it was learned through; multiclass casters keep separate lists. */
  classId: string
}

/** One planned level: which class takes it and, when that class level allows, the subclass and ASI or feat. */
export interface PlannedLevel {
  /** Character level (total of all classes) this entry is for. */
  level: number
  classId: string
  /** Picked when this level reaches the class's subclassLevel. */
  subclassId?: string
  /** At an ASI level: +2 to one ability or +1 to two, or a feat. */
  abilities?: Partial<Abilities>
  featId?: string
}

export type ActionKind = 'action' | 'bonus' | 'reaction' | 'free' | 'other'

/** An action the player wrote on the combat page (Curse Another, Douse with Oil...). */
export interface CustomAction {
  id: string
  kind: ActionKind
  name: string
  description?: string
  /** Rolled when the action is tapped. Dice may use STR…CHA, PROF and LEVEL, e.g. "1d8+CHA". */
  roll?: {
    /** 'attack' rolls d20 + ability modifier + proficiency first; 'save' shows a DC of 8 + proficiency + modifier. */
    check?: 'attack' | 'save'
    ability?: Ability
    /** The ability the target saves with. */
    save?: Ability
    dice?: string
    /** Damage type or "healing". */
    type?: string
  }
  /** Extra damage dice added to every attack while the action is switched on (like Hex). */
  effect?: { damage: string; type?: string }
  /** Stat changes while switched on (AC, ability scores, saves, checks, attack and damage bonuses…), same shape as item effects. */
  stats?: ItemEffect[]
  /** Switched on under Effects. Saved, so stat changes last until the player switches it off. */
  active?: boolean
}

export const CHARACTER_SCHEMA_VERSION = 1

/** A person using the app. Local profile for now; maps to an auth account once a backend exists. */
export interface UserProfile {
  id: string
  displayName: string
}

export interface Character {
  id: string
  /** UserProfile.id of the player who owns this character. */
  ownerId: string
  schemaVersion: number
  name: string
  playerName: string
  alignment: string
  portrait?: string
  /** Rules edition for the whole character: '2024' uses the SRD 5.2. Missing means 2014 (SRD 5.1). */
  rulesEdition?: '2024'
  raceId: string
  subraceId?: string
  /** SRD background id, or 'custom' with customBackground filled in. */
  backgroundId: string
  customBackground?: CustomBackground
  /** The builder creates one entry; the array leaves room for multiclassing. */
  classes: ClassLevel[]
  /** Subclasses the player built (subclassId 'custom'), one per class: features, spells, uses and effects. */
  customSubclasses?: SubclassData[]
  xp: number
  abilityMethod: AbilityMethod
  /** The six totals rolled in the builder (4d6, drop the lowest), kept so going back or editing never rerolls them. */
  rolledScores?: number[]
  /** Scores before racial bonuses. Use getAbilityScores() for final scores. */
  baseAbilities: Abilities
  /**
   * Abilities chosen for free +1s. 2014: racial picks (Half-Elf). 2024: the background's three +1s,
   * one entry per +1, so ['wis', 'wis', 'cha'] is +2 WIS and +1 CHA. Any ability; the background's are a suggestion.
   */
  freeAbilityBonuses: Ability[]
  /** 2014: where the player moved each fixed race/subrace bonus, in fixedRacialBonuses() order. Missing keeps the book's. */
  racialBonusTargets?: Ability[]
  /** 2014 Tasha's Customizing Your Origin: race skill, language and weapon proficiencies swapped, book id → new id. */
  originSwaps?: OriginSwaps
  /** Skills picked from class and free race choices. Race and background skills are added by the engine. */
  chosenSkills: SkillId[]
  /** Languages picked from race and background choices. Fixed ones are added by the engine. */
  chosenLanguages?: string[]
  /** Tools picked from race and class choices. */
  chosenTools?: string[]
  /** Race.traitChoice / Race.choices id → chosen option id, comma-separated when a choice takes several (Dragonborn ancestry). */
  traitChoices?: Record<string, string>
  /** Size picked when the race offers more than one (Race.sizeOptions). */
  sizeChoice?: Size
  /** Class choices, keyed `<classId>.<ClassChoice id>` → option id (2024 Fighting Style, Divine Order). */
  featureChoices?: Record<string, string>
  /** Picks from class option lists: invocations, pact boons, metamagic, maneuvers, fighting styles, infusions (rules/classOptions). */
  classOptions?: ClassOptionPick[]
  /** Class multi-picks, keyed `<classId>.<ClassPick id>` → skill ids (Expertise, Primal Knowledge). */
  classPicks?: Record<string, string[]>
  /** Weapon Mastery (2024): weapon item ids whose mastery property the character can use. */
  weaponMasteries?: string[]
  /** 2024 Human (Versatile): the Origin feat picked. */
  originFeatId?: string
  /** Ability Score Improvements or feats, one per slot the class levels grant. */
  improvements?: Improvement[]
  /** Starting gear: per class equipmentChoices entry, the option index and the items picked for its "any" slots. */
  equipmentPicks?: { option: number; items: string[] }[]
  inventory: InventoryEntry[]
  coins: { cp: number; sp: number; gp: number }
  notes: string
  /** Known or prepared spells (src/spellbook). Missing on older saves: none chosen. */
  spells?: KnownSpell[]
  /** Spell lists and counts: '2024' uses the SRD 5.2. Missing follows rulesEdition. Older saves set it on its own. */
  spellEdition?: '2014' | '2024'
  /** Pinned entries in display order; the spell entries are the sheet's pinned spells. */
  quickCast?: QuickCastEntry[]
  /** Actions, bonus actions, reactions and the like the player added on the combat page. */
  customActions?: CustomAction[]
  /** Planned future levels (src/planner), one per character level above the current one. A plan, not the build. */
  levelPlan?: PlannedLevel[]
  state: CharacterState
  createdAt: string
  updatedAt: string
}
