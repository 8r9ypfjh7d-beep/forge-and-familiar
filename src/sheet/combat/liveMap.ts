// What the sheet's Map tab shows a player: pure helpers over the party's live combat (src/combat/live).
import { moveProblem, type LiveCombat, type LiveCombatant } from '../../combat/liveLogic'
import type { Party } from '../../party/types'
import type { Token } from '../../combat/types'

/** The token this player may move: the one of the character they bring, when that is this sheet's character. */
export function ownToken(live: LiveCombat, characterId: string): Token | undefined {
  return live.board.tokens.find(t => t.characterId === characterId)
}

/** Whether this sheet's character is the one the player brings to the party. */
export const bringsCharacter = (party: Party | undefined, userId: string, characterId: string): boolean =>
  !!party && party.members.some(m => m.userId === userId && m.characterId === characterId)

export interface MapStatus {
  round: number
  /** Whose turn it is, as the live row names them, or undefined before the first turn. */
  active?: LiveCombatant
  /** True on this character's own turn. */
  yourTurn: boolean
  /** Why this player can't move right now, or null when they may. */
  cantMove: 'locked' | 'not-yours' | 'no-token' | null
  ownTokenId?: string
}

/** The status strip above the map and what the move controls allow. */
export function mapStatus(live: LiveCombat, characterId: string, brings: boolean): MapStatus {
  const active = live.encounter.combatants.find(c => c.id === live.encounter.activeId)
  const own = ownToken(live, characterId)
  const cantMove: MapStatus['cantMove'] = !brings || !own ? (own ? 'not-yours' : 'no-token') : live.board.locked ? 'locked' : null
  return {
    round: live.encounter.round,
    active,
    yourTurn: !!active && active.characterId === characterId,
    cantMove,
    ownTokenId: own?.id,
  }
}

/** The client-side check before a move is sent, the same rule the server applies. */
export const canMoveTo = (live: LiveCombat, characterId: string, tokenId: string, x: number, y: number) =>
  moveProblem(live.board, live.map, tokenId, x, y, { isDm: false, characterId })

/** Monster health words and party HP for a token's badge, from the public combatant list. */
export function tokenHealth(live: LiveCombat, token: Token): { health?: LiveCombatant['health']; hp?: { current: number; max: number } } {
  const c = live.encounter.combatants.find(c => c.id === token.combatantId)
  if (!c) return {}
  return c.hp ? { hp: { current: c.hp.current, max: c.hp.max } } : { health: c.health }
}
