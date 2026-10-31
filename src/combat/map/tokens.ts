// Token placement for a combat's board: who gets a token and where it starts. Pure.
import { autoPlace, UNPLACED } from '../../maps/logic'
import type { BattleMapDef, Edge } from '../../maps/types'
import { placeTokens } from '../liveLogic'
import type { Combatant, Encounter, LiveMap, Token } from '../types'

const OPPOSITE: Record<Edge, Edge> = { n: 's', s: 'n', e: 'w', w: 'e' }

/**
 * Tokens for every combatant: tokens already on the board stay where they are, tokens of combatants who left go,
 * new party members line up along the map's party edge and new monsters along the opposite edge, both spreading
 * out from the middle of the edge and skipping walls, water and hazards where they can.
 */
export function syncTokens(enc: Encounter, map: BattleMapDef, sizeOf: (c: Combatant) => 1 | 2 | 3 | 4): Token[] {
  const before = new Set((enc.board?.tokens ?? []).map(t => t.combatantId))
  const all = placeTokens(enc, map as unknown as LiveMap, sizeOf)
  const kept = all.filter(t => before.has(t.combatantId))
  const fresh = (npc: boolean) => all.filter(t => !before.has(t.combatantId) && (t.kind === 'npc') === npc).map(t => ({ ...t, x: UNPLACED, y: UNPLACED }))
  const strip = ({ hidden, ...t }: Token): Token => (hidden ? { ...t, hidden } : t)
  const mark = (t: Token) => ({ ...t, hidden: !!t.hidden })
  const withParty = autoPlace(map, [...kept, ...fresh(false)].map(mark))
  const far = { ...map, partyEdge: OPPOSITE[map.partyEdge ?? 's'] }
  const placed = autoPlace(far, [...withParty, ...fresh(true).map(mark)]).map(strip)
  // Keep initiative order, so the token list reads like the tracker.
  const byId = new Map(placed.map(t => [t.combatantId, t]))
  return enc.combatants.flatMap(c => byId.get(c.id) ?? [])
}
