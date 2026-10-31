// Token placement for a combat's board: who gets a token and where it starts. Pure.
import { autoPlace, fits, tokenCells, UNPLACED } from '../../maps/logic'
import type { BattleMapDef, Edge } from '../../maps/types'
import { placeTokens } from '../liveLogic'
import type { Combatant, Encounter, LiveMap, Token } from '../types'

const OPPOSITE: Record<Edge, Edge> = { n: 's', s: 'n', e: 'w', w: 'e' }

/**
 * Tokens for every combatant: tokens already on the board stay where they are, tokens of combatants who left go,
 * new party members line up along the map's party edge, and new monsters take the far (top) row where it is open;
 * a monster with no open spot there lines up along the edge opposite the party.
 */
export function syncTokens(enc: Encounter, map: BattleMapDef, sizeOf: (c: Combatant) => 1 | 2 | 3 | 4): Token[] {
  const before = new Set((enc.board?.tokens ?? []).map(t => t.combatantId))
  const all = placeTokens(enc, map as unknown as LiveMap, sizeOf)
  const kept = all.filter(t => before.has(t.combatantId))
  const taken = new Set(kept.filter(t => t.x >= 0).flatMap(t => tokenCells(t).map(c => `${c.x},${c.y}`)))
  const monsters: Token[] = []
  for (const t of all.filter(t => !before.has(t.combatantId) && t.kind === 'npc')) {
    const open = fits(map, t.x, t.y, t.size) && tokenCells(t).every(c => !taken.has(`${c.x},${c.y}`))
    if (open) for (const c of tokenCells(t)) taken.add(`${c.x},${c.y}`)
    monsters.push(open ? t : { ...t, x: UNPLACED, y: UNPLACED })
  }
  const party = all.filter(t => !before.has(t.combatantId) && t.kind !== 'npc').map(t => ({ ...t, x: UNPLACED, y: UNPLACED }))
  const strip = ({ hidden, ...t }: Token): Token => (hidden ? { ...t, hidden } : t)
  const mark = (t: Token) => ({ ...t, hidden: !!t.hidden })
  const withParty = autoPlace(map, [...kept, ...monsters.filter(t => t.x >= 0), ...party].map(mark))
  // Monsters with no open spot on the far row line up along the edge opposite the party instead.
  const far = { ...map, partyEdge: OPPOSITE[map.partyEdge ?? 's'] }
  const onEdge = autoPlace(far, [...withParty, ...monsters.filter(t => t.x < 0).map(mark)]).map(strip)
  const benched: Token[] = []
  // Keep initiative order, so the token list reads like the tracker.
  const byId = new Map([...onEdge, ...benched].map(t => [t.combatantId, t]))
  return enc.combatants.flatMap(c => byId.get(c.id) ?? [])
}
