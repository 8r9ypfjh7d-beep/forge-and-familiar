// Pure rules for the live battle map: what players may see, default token placement, move
// checks. Mirrored by the SQL in supabase/migrations/20261030210000_party_encounters.sql
// (project_public_encounter, project_public_board, move_token); keep the two in step.
import { playerView, type PlayerCombatant, type PlayerEncounter } from './playerView'
import type { Board, CellKey, Combatant, Encounter, LiveMap, Token } from './types'

/**
 * The encounter as the live row carries it: `playerView` of the DM's encounter (no log, no AC or
 * saves, monsters under their alias with a health look, hidden rows gone), so nothing DM-only ever
 * leaves the DM's device. The board travels in its own column.
 */
export type LiveEncounter = PlayerEncounter
export type LiveCombatant = PlayerCombatant

export interface LiveCombat {
  partyId: string
  encounter: LiveEncounter
  map: LiveMap | null
  board: Board
  rev: number
  startedAt: string
}

export const EMPTY_BOARD: Board = { tokens: [], fog: [], locked: false }

export const cellKey = (x: number, y: number): CellKey => `${x},${y}`

/** Whether a token's anchor cell is covered. */
export const inFog = (t: { x: number; y: number }, fog: CellKey[] | undefined): boolean =>
  (fog ?? []).includes(cellKey(t.x, t.y))

/**
 * Whether players get this token: not hidden by the DM (on the token or on its combatant row, which
 * `playerView` already dropped from `enc`) and not under fog.
 */
export const isPublicToken = (t: Token, board: Board, enc: LiveEncounter): boolean =>
  !t.hidden && !inFog(t, board.fog) && enc.combatants.some(c => c.id === t.combatantId)

/** The board as players see it. */
export function projectPublicBoard(board: Board, enc: LiveEncounter): Board {
  return {
    ...(board.mapId ? { mapId: board.mapId } : {}),
    tokens: board.tokens.filter(t => isPublicToken(t, board, enc)).map(({ hidden: _h, ...t }) => t),
    fog: board.fog ?? [],
    locked: board.locked ?? false,
  }
}

/** The encounter as players see it: on top of `playerView`, rows whose token is hidden or under fog go too. */
export function projectPublicEncounter(enc: LiveEncounter, board: Board): LiveEncounter {
  const gone = new Set(board.tokens.filter(t => t.hidden || inFog(t, board.fog)).map(t => t.combatantId))
  const combatants = enc.combatants.filter(c => !gone.has(c.id))
  const shown = new Set(combatants.map(c => c.id))
  return {
    ...enc,
    activeId: enc.activeId && shown.has(enc.activeId) ? enc.activeId : null,
    combatants,
    effects: enc.effects
      .map(e => ({ ...e, targetIds: e.targetIds.filter(id => shown.has(id)), ...(e.sourceId && !shown.has(e.sourceId) ? { sourceId: undefined } : {}) }))
      .filter(e => e.targetIds.length || (e.sourceId && shown.has(e.sourceId))),
  }
}

export const projectPublic = (live: LiveCombat): LiveCombat => ({
  ...live,
  encounter: projectPublicEncounter(live.encounter, live.board),
  board: projectPublicBoard(live.board, live.encounter),
})

/** The encounter column: `playerView` of the DM's encounter. The board has its own column. */
export const toLiveEncounter = (enc: Encounter): LiveEncounter => playerView(enc)

export const SIZE_CELLS: Record<string, 1 | 2 | 3 | 4> = {
  tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4,
}

/** Initials for a party member ("Vex Thorn" → "VT"), letter plus number for monsters ("Goblin" → "G1"). */
export function tokenLabel(c: Combatant, all: Combatant[]): string {
  if (c.kind === 'pc') {
    return c.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?'
  }
  const same = all.filter(o => o.kind === 'npc' && o.name.replace(/\s*\d+$/, '') === c.name.replace(/\s*\d+$/, ''))
  const n = same.length > 1 ? same.indexOf(c) + 1 : ''
  return `${(c.name[0] ?? '?').toUpperCase()}${n}`
}

const FALLBACK: LiveMap = { id: '', name: '', width: 24, height: 16 }

/**
 * Tokens for every combatant that has none yet: party members along the bottom edge, monsters
 * along the top, left to right, so starting a combat never needs manual placement. Existing tokens
 * are kept; tokens of combatants that left are dropped.
 */
export function placeTokens(enc: Encounter, map: LiveMap | null, sizeOf: (c: Combatant) => 1 | 2 | 3 | 4 = () => 1): Token[] {
  const m = map ?? FALLBACK
  const kept = (enc.board?.tokens ?? []).filter(t => enc.combatants.some(c => c.id === t.combatantId))
  const out = [...kept]
  const cursor = { pc: 0, npc: 0 }
  for (const c of enc.combatants) {
    if (out.some(t => t.combatantId === c.id)) continue
    const size = sizeOf(c)
    const x = Math.min(cursor[c.kind], Math.max(0, m.width - size))
    cursor[c.kind] += size + 1
    const y = c.kind === 'pc' ? Math.max(0, m.height - size) : 0
    out.push({
      id: `tok-${c.id}`, combatantId: c.id, kind: c.kind, label: tokenLabel(c, enc.combatants), x, y, size,
      ...(c.characterId ? { characterId: c.characterId } : {}),
    })
  }
  return out
}

export type MoveProblem = 'no-token' | 'locked' | 'not-yours' | 'off-map'

/**
 * Whether `userId` may put a token at (x, y). The DM may move anything anywhere on the map; a player
 * only the token of the character they bring (`characterId`), and not while the board is locked.
 */
export function moveProblem(
  board: Board, map: LiveMap | null, tokenId: string, x: number, y: number,
  who: { isDm: boolean; characterId?: string | null },
): MoveProblem | null {
  const tok = board.tokens.find(t => t.id === tokenId)
  if (!tok) return 'no-token'
  if (!who.isDm) {
    if (board.locked) return 'locked'
    if (!tok.characterId || tok.characterId !== who.characterId) return 'not-yours'
  }
  const size = Math.max(1, tok.size)
  if (x < 0 || y < 0 || (map && (x + size > map.width || y + size > map.height))) return 'off-map'
  return null
}

/** The board with one token moved. */
export const moveTokenOn = (board: Board, tokenId: string, x: number, y: number): Board => ({
  ...board,
  tokens: board.tokens.map(t => t.id === tokenId ? { ...t, x, y } : t),
})
