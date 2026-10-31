// What the party is allowed to see of an encounter. Pure, no React.
//
// The tracker is the DM's: its monster and NPC rows carry stats players must not learn (AC, HP,
// saves, the real name of a disguised villain). Anything that shows an encounter to players,
// now or later (a pushed battle map, a party-facing initiative list), goes through playerView()
// and never touches the Encounter itself. Party members' own rows need no redaction: members
// already read each other's characters (characters_party_read).
import type { Combatant, Effect, Encounter } from './types'
import type { ConditionId } from '../rules/types'

/** How hurt a creature looks, without numbers. Bloodied is the table's word for half HP or less. */
export type HealthLook = 'healthy' | 'bloodied' | 'down'

export interface PlayerCombatant {
  id: string
  kind: 'pc' | 'npc'
  /** The alias when the DM set one, else the name. */
  name: string
  /** pc only, so the party page can link to the sheet it already shows. */
  characterId?: string
  initiative: number | null
  /** npc only: how hurt it looks. */
  look?: HealthLook
  /** npc only, when the DM reveals HP. */
  hp?: { current: number; max: number; temp: number }
  conditions: ConditionId[]
  active: boolean
}

export interface PlayerEffect {
  id: string
  name: string
  /** Source and targets that players may see; hidden combatants are dropped. */
  sourceId?: string
  targetIds: string[]
  condition?: ConditionId
  concentration: boolean
  remaining: number | null
}

export interface PlayerEncounter {
  id: string
  name: string
  round: number
  activeId: string | null
  /** In initiative order, hidden rows left out. */
  combatants: PlayerCombatant[]
  effects: PlayerEffect[]
  updatedAt: string
}

export function healthLook(hp: { current: number; max: number } | undefined): HealthLook {
  if (!hp) return 'healthy'
  if (hp.current <= 0) return 'down'
  return hp.current * 2 <= hp.max ? 'bloodied' : 'healthy'
}

/** Whether players may know this row is in the fight at all. */
export const visibleToPlayers = (c: Combatant): boolean => c.kind === 'pc' || !c.hidden

/** A row as players see it. Returns null for a hidden one. */
export function playerCombatant(c: Combatant, activeId: string | null): PlayerCombatant | null {
  if (!visibleToPlayers(c)) return null
  const active = c.id === activeId
  if (c.kind === 'pc') {
    return { id: c.id, kind: 'pc', name: c.name, ...(c.characterId ? { characterId: c.characterId } : {}), initiative: c.initiative, conditions: c.conditions, active }
  }
  return {
    id: c.id,
    kind: 'npc',
    name: c.alias?.trim() || c.name,
    initiative: c.initiative,
    look: healthLook(c.hp),
    ...(c.revealHp && c.hp ? { hp: { ...c.hp } } : {}),
    conditions: c.conditions,
    active,
  }
}

function playerEffect(e: Effect, shown: Set<string>): PlayerEffect | null {
  const targetIds = e.targetIds.filter(id => shown.has(id))
  const sourceShown = !!e.sourceId && shown.has(e.sourceId)
  // An effect nobody visible is part of does not exist for players.
  if (targetIds.length === 0 && !sourceShown) return null
  return {
    id: e.id,
    name: e.name,
    ...(sourceShown ? { sourceId: e.sourceId } : {}),
    targetIds,
    ...(e.condition ? { condition: e.condition } : {}),
    concentration: e.concentration,
    remaining: e.remaining,
  }
}

/**
 * The encounter as the party may see it: no AC, saves, initiative bonuses, pending checks or the
 * DM's log; monsters under their alias with a health look instead of numbers (unless revealed);
 * hidden rows and anything about them gone. If the active turn belongs to a hidden row, players
 * see no active row.
 */
export function playerView(e: Encounter): PlayerEncounter {
  const combatants = e.combatants.map(c => playerCombatant(c, e.activeId)).filter((c): c is PlayerCombatant => c !== null)
  const shown = new Set(combatants.map(c => c.id))
  return {
    id: e.id,
    name: e.name,
    round: e.round,
    activeId: e.activeId && shown.has(e.activeId) ? e.activeId : null,
    combatants,
    effects: e.effects.map(x => playerEffect(x, shown)).filter((x): x is PlayerEffect => x !== null),
    updatedAt: e.updatedAt,
  }
}

/** Keys of a Combatant that must never reach players. The test keeps playerCombatant honest with it. */
export const DM_ONLY_FIELDS: readonly (keyof Combatant)[] = ['ac', 'conSave', 'initBonus', 'alias', 'hidden', 'revealHp']
