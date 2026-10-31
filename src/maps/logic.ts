// Pure battle-map rules: grid maths, painting, fog, token footprints, path cost and move checks.
// No DOM, no storage, no randomness. The live-combat RPC mirrors `checkMove` on the server.
import {
  CELL_FEET, DEFAULT_HEIGHT, DEFAULT_WIDTH, MAP_SCHEMA_VERSION, MAX_CELLS, MIN_CELLS, TERRAINS,
  type BattleMapDef, type Cell, type CellKey, type Diagonals, type Edge, type MapLabel, type MapPicture, type MapToken, type Rect, type Terrain, type TokenSize,
} from './types'

export const cellKey = (x: number, y: number): CellKey => `${x},${y}`

export function parseKey(key: string): Cell {
  const [x, y] = key.split(',').map(Number)
  return { x, y }
}

export const clampCells = (n: number) => Math.min(MAX_CELLS, Math.max(MIN_CELLS, Math.round(Number.isFinite(n) ? n : DEFAULT_WIDTH)))

export function createMap(id: string, ownerId: string, name: string, now: string, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT): BattleMapDef {
  return {
    id, ownerId, schemaVersion: MAP_SCHEMA_VERSION, name,
    width: clampCells(width), height: clampCells(height),
    terrain: {}, labels: [], fog: [], diagonals: '5', createdAt: now, updatedAt: now,
  }
}

const isTerrain = (v: unknown): v is Terrain => typeof v === 'string' && (TERRAINS as string[]).includes(v)
const isEdge = (v: unknown): v is Edge => v === 'n' || v === 's' || v === 'e' || v === 'w'

/** A saved or synced map made safe to use: bad cells dropped, sizes clamped, missing fields filled. */
export function normalizeMap(raw: unknown): BattleMapDef | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.ownerId !== 'string') return null
  const now = new Date(0).toISOString()
  const base = createMap(r.id, r.ownerId, typeof r.name === 'string' ? r.name : '', typeof r.createdAt === 'string' ? r.createdAt : now,
    typeof r.width === 'number' ? r.width : DEFAULT_WIDTH, typeof r.height === 'number' ? r.height : DEFAULT_HEIGHT)
  const inside = (c: Cell) => Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0 && c.x < base.width && c.y < base.height
  const terrain: Record<CellKey, Terrain> = {}
  if (r.terrain && typeof r.terrain === 'object') {
    for (const [k, v] of Object.entries(r.terrain as Record<string, unknown>)) {
      if (isTerrain(v) && v !== 'floor' && inside(parseKey(k))) terrain[k as CellKey] = v
    }
  }
  const labels: MapLabel[] = Array.isArray(r.labels)
    ? (r.labels as unknown[]).flatMap(l => {
      const o = l as Record<string, unknown>
      return o && typeof o.id === 'string' && typeof o.text === 'string' && typeof o.x === 'number' && typeof o.y === 'number' && inside({ x: o.x, y: o.y })
        ? [{ id: o.id, x: o.x, y: o.y, text: o.text.slice(0, 40) }] : []
    })
    : []
  const fog = Array.isArray(r.fog) ? [...new Set((r.fog as unknown[]).filter((k): k is CellKey => typeof k === 'string' && inside(parseKey(k))))].sort() : []
  let picture: MapPicture | undefined
  const p = r.picture as Record<string, unknown> | undefined
  if (p && typeof p.src === 'string' && typeof p.width === 'number' && typeof p.height === 'number') {
    picture = {
      src: p.src, width: p.width, height: p.height,
      cell: typeof p.cell === 'number' && p.cell > 0 ? p.cell : Math.max(8, Math.round(p.width / base.width)),
      offsetX: typeof p.offsetX === 'number' ? p.offsetX : 0, offsetY: typeof p.offsetY === 'number' ? p.offsetY : 0,
    }
  }
  return {
    ...base, terrain, labels, fog, picture,
    partyEdge: isEdge(r.partyEdge) ? r.partyEdge : undefined,
    diagonals: r.diagonals === '5-10-5' ? '5-10-5' : '5',
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : base.createdAt,
  }
}

export const inBounds = (map: Pick<BattleMapDef, 'width' | 'height'>, x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height

export const terrainAt = (map: BattleMapDef, x: number, y: number): Terrain => map.terrain[cellKey(x, y)] ?? 'floor'

/** Walls and closed doors cannot be entered. */
export const blocks = (t: Terrain) => t === 'wall' || t === 'door'
/** Difficult terrain, water and hazards cost every foot twice. */
export const isDifficult = (t: Terrain) => t === 'difficult' || t === 'water' || t === 'hazard'

/** The rectangle between two cells, whichever corner was tapped first. */
export function rectBetween(a: Cell, b: Cell): Rect {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 }
}

export function* cellsOf(rect: Rect): Generator<Cell> {
  for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) yield { x, y }
}

// ---------- Editing (every function returns a new map) ----------

export function paintRect(map: BattleMapDef, rect: Rect, terrain: Terrain): BattleMapDef {
  const next = { ...map.terrain }
  for (const c of cellsOf(rect)) {
    if (!inBounds(map, c.x, c.y)) continue
    if (terrain === 'floor') delete next[cellKey(c.x, c.y)]
    else next[cellKey(c.x, c.y)] = terrain
  }
  return { ...map, terrain: next }
}

export const paintCell = (map: BattleMapDef, x: number, y: number, terrain: Terrain) => paintRect(map, { x, y, w: 1, h: 1 }, terrain)

/** A closed door opens and back; anything else is left alone. */
export function toggleDoor(map: BattleMapDef, x: number, y: number): BattleMapDef {
  const t = terrainAt(map, x, y)
  return t === 'door' ? paintCell(map, x, y, 'doorOpen') : t === 'doorOpen' ? paintCell(map, x, y, 'door') : map
}

export function setLabel(map: BattleMapDef, label: MapLabel): BattleMapDef {
  const text = label.text.trim().slice(0, 40)
  const rest = map.labels.filter(l => l.id !== label.id && !(l.x === label.x && l.y === label.y))
  return { ...map, labels: text ? [...rest, { ...label, text }] : rest }
}

export const removeLabel = (map: BattleMapDef, id: string) => ({ ...map, labels: map.labels.filter(l => l.id !== id) })

export const labelAt = (map: BattleMapDef, x: number, y: number) => map.labels.find(l => l.x === x && l.y === y)

/** Fog as cell keys: the map holds the starting cover, the running combat's board holds the fog during play. */
export function coverCells(fog: CellKey[], rect: Rect, bounds: Pick<BattleMapDef, 'width' | 'height'>): CellKey[] {
  const set = new Set<CellKey>(fog)
  for (const c of cellsOf(rect)) if (inBounds(bounds, c.x, c.y)) set.add(cellKey(c.x, c.y))
  return [...set].sort()
}

export function revealCells(fog: CellKey[], rect: Rect): CellKey[] {
  const gone = new Set<string>()
  for (const c of cellsOf(rect)) gone.add(cellKey(c.x, c.y))
  return fog.filter(k => !gone.has(k))
}

export const coverFog = (map: BattleMapDef, rect: Rect): BattleMapDef => ({ ...map, fog: coverCells(map.fog, rect, map) })
export const revealFog = (map: BattleMapDef, rect: Rect): BattleMapDef => ({ ...map, fog: revealCells(map.fog, rect) })

export const isCovered = (map: BattleMapDef, x: number, y: number) => map.fog.includes(cellKey(x, y))

/** Resizing keeps what still fits. */
export function resizeMap(map: BattleMapDef, width: number, height: number): BattleMapDef {
  const sized = { ...map, width: clampCells(width), height: clampCells(height) }
  const keep = (k: string) => { const c = parseKey(k); return inBounds(sized, c.x, c.y) }
  return {
    ...sized,
    terrain: Object.fromEntries(Object.entries(map.terrain).filter(([k]) => keep(k))),
    labels: map.labels.filter(l => inBounds(sized, l.x, l.y)),
    fog: map.fog.filter(keep),
  }
}

/** How many whole cells a picture covers at a given cell size and offset, clamped to the grid limits. */
export function gridFromPicture(picture: Pick<MapPicture, 'width' | 'height' | 'cell' | 'offsetX' | 'offsetY'>): { width: number; height: number } {
  const cell = Math.max(1, picture.cell)
  return {
    width: clampCells(Math.floor((picture.width - picture.offsetX) / cell)),
    height: clampCells(Math.floor((picture.height - picture.offsetY) / cell)),
  }
}

/** Puts a picture under the grid and sizes the grid to it; `cells` says how many squares fit across the picture. */
export function setPicture(map: BattleMapDef, picture: Omit<MapPicture, 'cell' | 'offsetX' | 'offsetY'>, cellsAcross = DEFAULT_WIDTH): BattleMapDef {
  const cell = Math.max(4, picture.width / clampCells(cellsAcross))
  const full: MapPicture = { ...picture, cell, offsetX: 0, offsetY: 0 }
  const size = gridFromPicture(full)
  return resizeMap({ ...map, picture: full }, size.width, size.height)
}

/** Moves the grid lines over the picture; the grid is resized to what still fits. */
export function fitPicture(map: BattleMapDef, fit: Partial<Pick<MapPicture, 'cell' | 'offsetX' | 'offsetY'>>): BattleMapDef {
  if (!map.picture) return map
  const picture: MapPicture = {
    ...map.picture,
    cell: Math.max(4, fit.cell ?? map.picture.cell),
    offsetX: Math.max(0, fit.offsetX ?? map.picture.offsetX),
    offsetY: Math.max(0, fit.offsetY ?? map.picture.offsetY),
  }
  const size = gridFromPicture(picture)
  return resizeMap({ ...map, picture }, size.width, size.height)
}

export const removePicture = (map: BattleMapDef): BattleMapDef => {
  const { picture: _p, ...rest } = map
  return rest
}

// ---------- Tokens ----------

/** Cells on a side for a creature size word ("Medium", "Huge"); unknown sizes count as Medium. */
export function footprintOf(size: string | undefined): TokenSize {
  switch ((size ?? '').toLowerCase()) {
    case 'large': return 2
    case 'huge': return 3
    case 'gargantuan': return 4
    default: return 1
  }
}

export function tokenCells(token: Pick<MapToken, 'x' | 'y' | 'size'>): Cell[] {
  return [...cellsOf({ x: token.x, y: token.y, w: token.size, h: token.size })]
}

export const tokenAt = (tokens: MapToken[], x: number, y: number) =>
  tokens.find(tk => x >= tk.x && x < tk.x + tk.size && y >= tk.y && y < tk.y + tk.size)

/** Whether a token of this size could stand with its top-start corner here: inside the grid, on no wall. */
export function fits(map: BattleMapDef, x: number, y: number, size: TokenSize): boolean {
  for (const c of tokenCells({ x, y, size })) {
    if (!inBounds(map, c.x, c.y) || blocks(terrainAt(map, c.x, c.y))) return false
  }
  return true
}

/** What players get: hidden tokens and tokens with any cell under fog are left out. Fog defaults to the map's. */
export function publicTokens<T extends MapToken>(map: BattleMapDef, tokens: T[], fog: string[] = map.fog): T[] {
  return tokens.filter(tk => !tk.hidden && !tokenCells(tk).some(c => fog.includes(cellKey(c.x, c.y))))
}

/** The cell a token occupies with its centre, for distances between big creatures. */
export const tokenCentre = (token: Pick<MapToken, 'x' | 'y' | 'size'>): Cell => ({ x: token.x + (token.size - 1) / 2, y: token.y + (token.size - 1) / 2 })

// ---------- Distance and paths ----------

/** Feet between two cells as the crow flies over squares: every diagonal 5 ft, or 5-10-5 with the variant rule. */
export function distanceFeet(a: Cell, b: Cell, diagonals: Diagonals = '5'): number {
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y)
  const long = Math.max(dx, dy), short = Math.min(dx, dy)
  const squares = diagonals === '5-10-5' ? long + Math.floor(short / 2) : long
  return squares * CELL_FEET
}

/** Edge-to-edge distance between two tokens, as reach is measured. */
export function tokenDistanceFeet(a: Pick<MapToken, 'x' | 'y' | 'size'>, b: Pick<MapToken, 'x' | 'y' | 'size'>, diagonals: Diagonals = '5'): number {
  const gap = (a0: number, as: number, b0: number, bs: number) => Math.max(0, b0 - (a0 + as - 1), a0 - (b0 + bs - 1))
  const dx = gap(a.x, a.size, b.x, b.size), dy = gap(a.y, a.size, b.y, b.size)
  return distanceFeet({ x: 0, y: 0 }, { x: dx, y: dy }, diagonals)
}

export interface PathResult {
  /** Feet spent, difficult terrain counted twice. */
  cost: number
  /** Every cell from start to goal, start included. */
  path: Cell[]
}

export interface PathOptions {
  size?: TokenSize
  /** Tokens on the board; a mover may pass through none of them and end on none of them. Its own id is skipped. */
  tokens?: MapToken[]
  moverId?: string
  /** Stop looking past this many feet (speed + dash); saves work on big maps. */
  maxCost?: number
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

/**
 * Cheapest path for a token from one top-start cell to another: Dijkstra over cells (and diagonal parity under
 * 5-10-5). Walls, closed doors, the grid edge and other tokens block; diagonal steps may not cut a wall's corner;
 * entering difficult terrain, water or a hazard with any cell of the footprint costs double. Null when unreachable.
 */
export function findPath(map: BattleMapDef, from: Cell, to: Cell, opts: PathOptions = {}): PathResult | null {
  const size = opts.size ?? 1
  const others = (opts.tokens ?? []).filter(tk => tk.id !== opts.moverId)
  const occupied = new Set<string>()
  for (const tk of others) for (const c of tokenCells(tk)) occupied.add(cellKey(c.x, c.y))
  const free = (x: number, y: number) => fits(map, x, y, size) && !tokenCells({ x, y, size }).some(c => occupied.has(cellKey(c.x, c.y)))
  if (!free(from.x, from.y) && !(from.x === to.x && from.y === to.y)) {
    // A token standing somewhere it could not enter (placed by the DM) may still leave.
    if (!inBounds(map, from.x, from.y)) return null
  }
  if (!free(to.x, to.y)) return null
  if (from.x === to.x && from.y === to.y) return { cost: 0, path: [from] }
  const variant = map.diagonals === '5-10-5'
  const stepCost = (x: number, y: number, diagonal: boolean, odd: boolean) => {
    const hard = tokenCells({ x, y, size }).some(c => isDifficult(terrainAt(map, c.x, c.y)))
    const base = diagonal && variant && odd ? CELL_FEET * 2 : CELL_FEET
    return hard ? base * 2 : base
  }
  const limit = opts.maxCost ?? Number.POSITIVE_INFINITY
  const stateKey = (x: number, y: number, odd: number) => `${x},${y},${variant ? odd : 0}`
  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const open: { x: number; y: number; odd: number; d: number }[] = [{ x: from.x, y: from.y, odd: 0, d: 0 }]
  dist.set(stateKey(from.x, from.y, 0), 0)
  while (open.length) {
    // Small grids: a sorted pop is simpler than a heap and fast enough for 3600 cells.
    let bi = 0
    for (let i = 1; i < open.length; i++) if (open[i].d < open[bi].d) bi = i
    const cur = open.splice(bi, 1)[0]
    const curKey = stateKey(cur.x, cur.y, cur.odd)
    if (cur.d > (dist.get(curKey) ?? Number.POSITIVE_INFINITY)) continue
    if (cur.x === to.x && cur.y === to.y) {
      const path: Cell[] = []
      let k: string | undefined = curKey
      while (k) {
        const c = parseKey(k)
        path.push({ x: c.x, y: c.y })
        k = prev.get(k)
      }
      return { cost: cur.d, path: path.reverse() }
    }
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy
      if (!free(nx, ny)) continue
      const diagonal = dx !== 0 && dy !== 0
      // No squeezing between two walls: both orthogonal neighbours must be enterable.
      if (diagonal && (!fits(map, cur.x + dx, cur.y, size) || !fits(map, cur.x, cur.y + dy, size))) continue
      const odd = diagonal ? 1 - cur.odd : cur.odd
      const d = cur.d + stepCost(nx, ny, diagonal, cur.odd === 1)
      if (d > limit) continue
      const key = stateKey(nx, ny, odd)
      if (d < (dist.get(key) ?? Number.POSITIVE_INFINITY)) {
        dist.set(key, d)
        prev.set(key, curKey)
        open.push({ x: nx, y: ny, odd, d })
      }
    }
  }
  return null
}

export type MoveProblem = 'outside' | 'blocked' | 'occupied' | 'unreachable'

export interface MoveCheck {
  ok: boolean
  problem?: MoveProblem
  cost: number
  path: Cell[]
  /** True when the move costs more than the budget given; a warning, not a block. */
  overBudget: boolean
}

/**
 * Whether a token may step to a cell, and what it costs. Budget is the feet left this turn (speed minus moves so far);
 * going past it is allowed but flagged, as the brainstorm decided ("warn, don't block").
 */
export function checkMove(map: BattleMapDef, tokens: MapToken[], token: MapToken, to: Cell, budget = Number.POSITIVE_INFINITY): MoveCheck {
  const none = (problem: MoveProblem): MoveCheck => ({ ok: false, problem, cost: 0, path: [], overBudget: false })
  if (!tokenCells({ ...to, size: token.size }).every(c => inBounds(map, c.x, c.y))) return none('outside')
  if (!fits(map, to.x, to.y, token.size)) return none('blocked')
  const others = tokens.filter(tk => tk.id !== token.id)
  if (tokenCells({ ...to, size: token.size }).some(c => tokenAt(others, c.x, c.y))) return none('occupied')
  const found = findPath(map, { x: token.x, y: token.y }, to, { size: token.size, tokens, moverId: token.id })
  if (!found) return none('unreachable')
  return { ok: true, cost: found.cost, path: found.path, overBudget: found.cost > budget }
}

/** Tokens not on the board yet carry this position until autoPlace or the DM puts them down. */
export const UNPLACED = -1

/**
 * Lines up every token that is still off the board (x or y UNPLACED) along the party edge, or the south edge when
 * none is set, skipping walls, water, hazards and each other, so starting a combat never needs manual placement. Tokens already
 * on the board are kept where they are.
 */
const UNSAFE = new Set<Terrain>(['water', 'hazard'])

export function autoPlace(map: BattleMapDef, tokens: MapToken[]): MapToken[] {
  const edge = map.partyEdge ?? 's'
  const onBoard = (tk: MapToken) => tk.x !== UNPLACED && tk.y !== UNPLACED && inBounds(map, tk.x, tk.y)
  const taken = new Set(tokens.filter(onBoard).flatMap(tk => tokenCells(tk).map(c => cellKey(c.x, c.y))))
  const candidates: Cell[] = []
  const lines = Math.max(map.width, map.height)
  const mid = Math.floor((edge === 'n' || edge === 's' ? map.width : map.height) / 2)
  for (let depth = 0; depth < lines; depth++) {
    for (let i = 0; i < lines; i++) {
      // Spread outwards from the middle of the edge, then one line deeper.
      const along = mid + (i % 2 ? -Math.ceil(i / 2) : Math.ceil(i / 2))
      const c = edge === 'n' ? { x: along, y: depth } : edge === 's' ? { x: along, y: map.height - 1 - depth }
        : edge === 'w' ? { x: depth, y: along } : { x: map.width - 1 - depth, y: along }
      if (inBounds(map, c.x, c.y)) candidates.push(c)
    }
  }
  // Big tokens hang inwards from the edge cell they are given.
  const corner = (c: Cell, size: TokenSize): Cell => ({ x: c.x - (edge === 'e' ? size - 1 : 0), y: c.y - (edge === 's' ? size - 1 : 0) })
  const open = (at: Cell, size: TokenSize) =>
    fits(map, at.x, at.y, size) && !tokenCells({ ...at, size }).some(cell => taken.has(cellKey(cell.x, cell.y)))
  // Nobody starts in water or on a hazard (pits, fire) when a dry square is free somewhere on the map.
  const dry = (at: Cell, size: TokenSize) => tokenCells({ ...at, size }).every(cell => !UNSAFE.has(terrainAt(map, cell.x, cell.y)))
  return tokens.map(tk => {
    if (onBoard(tk)) return tk
    const spot = candidates.find(c => { const at = corner(c, tk.size); return open(at, tk.size) && dry(at, tk.size) })
      ?? candidates.find(c => open(corner(c, tk.size), tk.size))
    const at = spot ? corner(spot, tk.size) : { x: 0, y: 0 }
    for (const cell of tokenCells({ ...at, size: tk.size })) taken.add(cellKey(cell.x, cell.y))
    return { ...tk, ...at }
  })
}

/** Short name for a list row: "24 × 16, picture". */
export const mapSummary = (map: BattleMapDef) => `${map.width} × ${map.height}`

/** Newest first. */
export const sortMaps = (maps: BattleMapDef[]) => [...maps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
