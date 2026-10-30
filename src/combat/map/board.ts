// Pure helpers for the board during play: fog brushes on Board.fog, token lookups, movement budget.
// No React. The map module (src/maps/logic) does path and distance maths; this file adapts it to the live Board.
import { cellKey, cellsOf, inBounds, rectBetween } from '../../maps/logic'
import type { BattleMapDef, Cell } from '../../maps/types'
import type { Board, CellKey, Token } from '../types'

/** Fog with every cell of the rectangle between two corners covered (inside the grid only). */
export function coverFog(fog: CellKey[], a: Cell, b: Cell, map: Pick<BattleMapDef, 'width' | 'height'>): CellKey[] {
  const set = new Set<CellKey>(fog)
  for (const c of cellsOf(rectBetween(a, b))) if (inBounds(map, c.x, c.y)) set.add(cellKey(c.x, c.y) as CellKey)
  return [...set]
}

/** Fog with the rectangle between two corners revealed. */
export function revealFog(fog: CellKey[], a: Cell, b: Cell): CellKey[] {
  const gone = new Set<string>()
  for (const c of cellsOf(rectBetween(a, b))) gone.add(cellKey(c.x, c.y))
  return fog.filter(k => !gone.has(k))
}

export const tokenCovering = (tokens: Token[], x: number, y: number): Token | undefined =>
  tokens.find(t => t.x >= 0 && x >= t.x && x < t.x + t.size && y >= t.y && y < t.y + t.size)

export const isPlaced = (t: Token) => t.x >= 0 && t.y >= 0

/** Feet a token may still move this turn: speed (doubled by dash) minus what it spent. Null without a speed. */
export function budgetLeft(speed: number | undefined, spent: number, dash: boolean): number | null {
  if (speed === undefined) return null
  return Math.max(0, speed * (dash ? 2 : 1) - spent)
}

export type Spent = Record<string, number>

/** Movement spent per token this turn; everything resets when the turn changes. */
export function spend(spent: Spent, tokenId: string, feet: number): Spent {
  return { ...spent, [tokenId]: (spent[tokenId] ?? 0) + feet }
}

export const withToken = (board: Board, tokenId: string, patch: Partial<Token>): Board => ({
  ...board, tokens: board.tokens.map(t => (t.id === tokenId ? { ...t, ...patch } : t)),
})

/** Tokens the viewer may pick up: the DM any, a player only their own character's. */
export function canMove(token: Token, viewer: { role: 'dm' } | { role: 'player'; characterId: string }, locked: boolean): boolean {
  if (viewer.role === 'dm') return true
  return !locked && !!token.characterId && token.characterId === viewer.characterId
}
