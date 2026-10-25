// Saved character shape, shared by the builder (creates it) and the live sheet (plays it).
// Everything not stored here (max HP, AC, modifiers, slots, resource maxima) is derived by src/rules.
import type { QuickCastEntry } from '../quickcast/types'
import type { Abilities, Ability, ConditionId, InventoryEntry, SkillId } from '../rules/types'

export type AbilityMethod = 'standard' | 'pointBuy' | 'manual'
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
}

/** A spell the character knows or has prepared, from the content library (src/content). */
export interface KnownSpell {
  /** Library spell id, e.g. "fireball". The same id names the spell in both rules editions. */
  id: string
  /** The class it was learned through; multiclass casters keep separate lists. */
  classId: string
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
  /** A toggle in Effects that adds this to every attack's damage while it is on (like Hex). */
  effect?: { damage: string; type?: string }
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
  /** Visual theme id from src/themes; missing or unknown means the app's default look. */
  theme?: string
  raceId: string
  subraceId?: string
  /** SRD background id, or 'custom' with customBackground filled in. */
  backgroundId: string
  customBackground?: CustomBackground
  /** The builder creates one entry; the array leaves room for multiclassing. */
  classes: ClassLevel[]
  xp: number
  abilityMethod: AbilityMethod
  /** Scores before racial bonuses. Use getAbilityScores() for final scores. */
  baseAbilities: Abilities
  /** Abilities chosen for free racial +1s (Half-Elf). */
  freeAbilityBonuses: Ability[]
  /** Skills picked from class and free race choices. Race and background skills are added by the engine. */
  chosenSkills: SkillId[]
  /** Languages picked from race and background choices. Fixed ones are added by the engine. */
  chosenLanguages?: string[]
  /** Tools picked from race and class choices. */
  chosenTools?: string[]
  /** Race.traitChoice id → chosen option id (Dragonborn ancestry). */
  traitChoices?: Record<string, string>
  /** Ability Score Improvements or feats, one per slot the class levels grant. */
  improvements?: Improvement[]
  /** Starting gear: per class equipmentChoices entry, the option index and the items picked for its "any" slots. */
  equipmentPicks?: { option: number; items: string[] }[]
  inventory: InventoryEntry[]
  coins: { cp: number; sp: number; gp: number }
  notes: string
  /** Known or prepared spells (src/spellbook). Missing on older saves: none chosen. */
  spells?: KnownSpell[]
  /** Rules edition for spell lists and counts: '2024' uses the SRD 5.2. Missing means 2014 (SRD 5.1). */
  spellEdition?: '2014' | '2024'
  /** Spells, attacks and resources pinned to the sheet's quick-cast bar, in display order. */
  quickCast?: QuickCastEntry[]
  /** Actions, bonus actions, reactions and the like the player added on the combat page. */
  customActions?: CustomAction[]
  state: CharacterState
  createdAt: string
  updatedAt: string
}
