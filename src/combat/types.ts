// Saved encounter shape. Party members link to a Character, whose HP and conditions stay on
// the character (the sheet owns them). Monsters and NPCs keep their own HP here.
import type { MessageKey } from '../i18n/locales/en'
import type { ConditionId } from '../rules/types'

export const ENCOUNTER_SCHEMA_VERSION = 1

export interface Combatant {
  id: string
  name: string
  kind: 'pc' | 'npc'
  /** pc only: the Character this row plays. */
  characterId?: string
  /** null until rolled or typed. */
  initiative: number | null
  /** Initiative modifier: rolls for NPCs and breaks ties (higher DEX goes first). */
  initBonus: number
  /** npc only. */
  hp?: { current: number; max: number; temp: number }
  ac?: number
  /** npc only: CON save bonus for concentration checks. */
  conSave?: number
  /** npc only: conditions set by hand. For a pc they live on character.state.conditions. */
  conditions: ConditionId[]
}

/** A spell or effect with a duration. Ticks on its source's turn; with no source, at the top of each round. */
export interface Effect {
  id: string
  name: string
  sourceId?: string
  targetIds: string[]
  /** Applied to every target while the effect lasts, removed when it ends. */
  condition?: ConditionId
  /** Ends when the source loses concentration. A source holds one concentration effect at a time. */
  concentration: boolean
  /** Rounds left; null lasts until ended by hand (or by losing concentration). */
  remaining: number | null
  /** Count down at the start or at the end of the source's turn ("until the end of your next turn"). */
  tick: 'start' | 'end'
  /** False while the turn it was created on has not ended yet, so that end does not count. */
  armed: boolean
}

/** A log line, translated when shown. Plain strings come from saves made before translation. */
export type LogLine = string | { key: MessageKey; vars?: Record<string, string | number> }

/** A concentration save the table still has to roll. */
export interface PendingCheck {
  id: string
  combatantId: string
  dc: number
}

export interface Encounter {
  id: string
  ownerId: string
  schemaVersion: number
  name: string
  /** 0 before combat starts. */
  round: number
  /** Whose turn it is, once combat has started. */
  activeId: string | null
  /** Kept in initiative order. */
  combatants: Combatant[]
  effects: Effect[]
  pendingChecks: PendingCheck[]
  /** Newest first. */
  log: LogLine[]
  createdAt: string
  updatedAt: string
}

export const CONDITIONS: ConditionId[] = [
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible',
  'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious',
]
