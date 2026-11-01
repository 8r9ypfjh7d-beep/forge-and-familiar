// Saved encounter shape. Party members link to a Character, whose HP and conditions stay on
// the character (the sheet owns them). Monsters and NPCs keep their own HP here.
import type { MessageKey } from '../i18n/locales/en'
import type { Ability, ConditionId } from '../rules/types'

export const ENCOUNTER_SCHEMA_VERSION = 1

export interface Combatant {
  id: string
  name: string
  kind: 'pc' | 'npc'
  /** pc only: the Character this row plays. */
  characterId?: string
  /** npc only: a DM-private NPC sheet (src/npc) this row plays; its HP and conditions live there. */
  npcId?: string
  /** npc only: the library stat block (src/content monsters), so the fight shows its actions. */
  monster?: { source: string; id: string }
  /** npc only: uses spent per action name (X/Day actions count up, a recharge action is 1 while spent). */
  spent?: Record<string, number>
  /** npc only: legendary actions used since the start of its last turn. */
  legendaryUsed?: number
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
  /** npc only: what players are told this creature is ("Hooded figure"); the real name stays with the DM. */
  alias?: string
  /** npc only: not shown to players at all (an unseen ambusher, an invisible stalker). */
  hidden?: boolean
  /** npc only: players see the HP numbers and bar; otherwise only healthy / bloodied / down. */
  revealHp?: boolean
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
  /** Targets repeat this save at the end of each of their turns (Hold Person); a success frees that target. */
  save?: { ability: Ability; dc: number }
}

/** A log line, translated when shown. Plain strings come from saves made before translation. */
export type LogLine = string | { key: MessageKey; vars?: Record<string, string | number> }

/** A save the table still has to roll: concentration after damage, or an effect's repeat save at the end of a turn. */
export interface PendingCheck {
  id: string
  combatantId: string
  dc: number
  /** Set for an effect's repeat save; absent for concentration (a CON save). */
  effectId?: string
  ability?: Ability
}

/** A piece on the battle map. Cells count from the top-left corner; a token covers size × size cells. */
export interface Token {
  id: string
  combatantId: string
  /** pc tokens: the character this token plays, so its player may move it. */
  characterId?: string
  /** Colour hint: party member, enemy, or a friendly npc. */
  kind: 'pc' | 'npc' | 'ally'
  /** Short text on the token: initials for a party member, "G1" for a monster. */
  label: string
  x: number
  y: number
  /** Footprint in cells: Medium 1, Large 2, Huge 3, Gargantuan 4. */
  size: 1 | 2 | 3 | 4
  /** DM-only: the token (and its combatant) exist only on the DM's view. A hidden combatant row hides its token too. */
  hidden?: boolean
  color?: string
}

/** A cell as a key, "x,y" (src/maps uses the same keys). */
export type CellKey = `${number},${number}`

/** Everything on the map that changes during play. Lives on the DM's Encounter and on the live row. */
export interface Board {
  /** The map this combat is fought on (src/maps); undefined for a map-less combat. */
  mapId?: string
  tokens: Token[]
  /** Covered cells (DM-painted fog), as "x,y" keys. Starts as the map's own fog. */
  fog: CellKey[]
  /** True freezes player moves; the DM always moves. */
  locked: boolean
}

/** The part of a map (src/maps) the live row and move checks need. A map's saved shape extends it. */
export interface LiveMap {
  id: string
  name: string
  /** Cells across and down. */
  width: number
  height: number
  /** Cells covered when the combat starts, as "x,y" keys. */
  fog?: CellKey[]
  [extra: string]: unknown
}

/**
 * Damage or healing the DM dealt to a party member whose character lives on the player's phone.
 * It rides the live row (playerView) and the player's own device applies it once (`Character.appliedHits`).
 */
export interface Hit {
  id: string
  characterId: string
  kind: 'damage' | 'heal'
  amount: number
  critical?: boolean
  at: string
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
  /** Battle map state, once the combat has a map or tokens. */
  board?: Board
  /** Hits for characters on players' phones, newest last, capped at HIT_LIMIT. */
  hits?: Hit[]
  /** The DM screen plan this fight was started from. */
  planId?: string
  /** The plan's DM notes, copied at Start and editable here. DM only: playerView never sends them. */
  notes?: string
  /** Set by End combat, cleared when combat starts again. */
  endedAt?: string
  /** The last round fought before End combat. */
  endedRound?: number
  createdAt: string
  updatedAt: string
}

export const CONDITIONS: ConditionId[] = [
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible',
  'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious',
]
