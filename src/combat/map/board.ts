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

/**
 * The DM's board with token positions taken from the live row, where players moved them. Only positions
 * of tokens both boards know change; fog, lock, sizes and hidden flags stay the DM's. Same object when
 * nothing moved, so the caller can skip a write.
 */
export function mergeRemoteMoves(local: Board, remote: Board | undefined): Board {
  if (!remote) return local
  const pos = new Map(remote.tokens.map(t => [t.id, t]))
  let changed = false
  const tokens = local.tokens.map(t => {
    const r = pos.get(t.id)
    if (!r || (r.x === t.x && r.y === t.y)) return t
    changed = true
    return { ...t, x: r.x, y: r.y }
  })
  return changed ? { ...local, tokens } : local
}

/** The square around every placed token, as a focus for opening the map on them. Undefined when none is placed. */
export function tokensBox(tokens: Token[]): { x: number; y: number; size: number } | undefined {
  const placed = tokens.filter(isPlaced)
  if (!placed.length) return undefined
  const x0 = Math.min(...placed.map(t => t.x)), y0 = Math.min(...placed.map(t => t.y))
  const x1 = Math.max(...placed.map(t => t.x + t.size)), y1 = Math.max(...placed.map(t => t.y + t.size))
  const size = Math.max(x1 - x0, y1 - y0)
  return { x: x0 - (size - (x1 - x0)) / 2, y: y0 - (size - (y1 - y0)) / 2, size }
}
