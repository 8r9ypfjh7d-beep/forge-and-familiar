// Saved battle map shape (see MAPS.md). A map is the static board: grid, painted terrain, labels, an optional
// picture under the grid, DM-painted fog and the edge the party enters from. Tokens live in the running
// combat (src/combat/live.ts), never in the map, so one map serves many fights.

import type { CellKey, Token } from '../combat/types'

export type { CellKey }

export const MAP_SCHEMA_VERSION = 1

export const MIN_CELLS = 5
export const MAX_CELLS = 60
export const DEFAULT_WIDTH = 24
export const DEFAULT_HEIGHT = 16
/** Feet per grid cell (the SRD square). */
export const CELL_FEET = 5

/**
 * What a cell is. Floor is the default and is never stored. Walls and closed doors block movement; difficult
 * terrain, water and hazards cost double; open doors and stairs are floor with a glyph (stairs mark elevation).
 */
export type Terrain = 'floor' | 'wall' | 'difficult' | 'water' | 'door' | 'doorOpen' | 'hazard' | 'stairs'
export const TERRAINS: Terrain[] = ['floor', 'wall', 'difficult', 'water', 'door', 'doorOpen', 'hazard', 'stairs']

export type Diagonals = '5' | '5-10-5'
export type Edge = 'n' | 's' | 'e' | 'w'

export interface Cell { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export interface MapLabel {
  id: string
  x: number
  y: number
  /** Short tag shown on the cell: "Altar", "Pit 20 ft". */
  text: string
}

/** A picture under the grid, with the grid fitted to it: `cell` is one square in picture pixels, offsets too. */
export interface MapPicture {
  /** Downscaled JPEG data URL (src/lore/image.ts, 2048 px long side). */
  src: string
  width: number
  height: number
  cell: number
  offsetX: number
  offsetY: number
}

/** A type alias, not an interface, so a map passes as the live combat's `LiveMap` (which has an index signature). */
export type BattleMapDef = {
  id: string
  ownerId: string
  schemaVersion: number
  name: string
  /** Cells across and down, MIN_CELLS..MAX_CELLS. */
  width: number
  height: number
  /** Sparse: "x,y" → terrain for every cell that is not floor. */
  terrain: Record<CellKey, Terrain>
  labels: MapLabel[]
  picture?: MapPicture
  /** "x,y" keys of cells covered by fog. Players see dark glass there and no tokens. */
  fog: CellKey[]
  /** Where the party starts; auto-placement lines tokens up along it. */
  partyEdge?: Edge
  diagonals: Diagonals
  createdAt: string
  updatedAt: string
}

/** Cells on a side: Tiny/Small/Medium 1, Large 2, Huge 3, Gargantuan 4. */
export type TokenSize = 1 | 2 | 3 | 4

/** A combatant on the board: the live combat's token (src/combat/types.ts). The map module only does the maths. */
export type MapToken = Token
