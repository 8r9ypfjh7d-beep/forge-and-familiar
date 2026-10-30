// Four starter maps shipped with the app, so the first combat takes one tap. Pure: built from the paint helpers.
import { coverFog, createMap, paintRect, setLabel } from './logic'
import type { BattleMapDef, Edge, Rect, Terrain } from './types'

export type TemplateId = 'tavern' | 'forest' | 'corridor' | 'field'
export const TEMPLATE_IDS: TemplateId[] = ['tavern', 'forest', 'corridor', 'field']

interface Template {
  width: number
  height: number
  partyEdge: Edge
  paint: [Terrain, Rect][]
  labels: [number, number, string][]
  fog?: Rect[]
}

const row = (x: number, y: number, w: number, h = 1): Rect => ({ x, y, w, h })

const TEMPLATES: Record<TemplateId, Template> = {
  tavern: {
    width: 20, height: 14, partyEdge: 's',
    paint: [
      ['wall', row(0, 0, 20)], ['wall', row(0, 13, 20)], ['wall', row(0, 0, 1, 14)], ['wall', row(19, 0, 1, 14)],
      ['door', row(9, 13, 1)],
      // Bar along the north wall, kitchen wall with a door, stairs in a corner.
      ['wall', row(2, 2, 12)], ['wall', row(15, 1, 1, 5)], ['door', row(15, 3, 1)],
      ['stairs', row(17, 1, 2, 1)],
      // Tables (difficult to climb over).
      ['difficult', row(3, 5, 2, 2)], ['difficult', row(8, 5, 2, 2)], ['difficult', row(13, 7, 2, 2)], ['difficult', row(4, 9, 2, 2)], ['difficult', row(9, 9, 2, 2)],
    ],
    labels: [[7, 1, 'Bar'], [17, 2, 'Stairs up'], [16, 1, 'Kitchen']],
  },
  forest: {
    width: 24, height: 18, partyEdge: 'w',
    paint: [
      // Tree trunks block; undergrowth around them is difficult; a stream runs across.
      ['difficult', row(3, 2, 3, 3)], ['wall', row(4, 3, 1)],
      ['difficult', row(9, 1, 3, 3)], ['wall', row(10, 2, 1)],
      ['difficult', row(17, 3, 3, 3)], ['wall', row(18, 4, 1)],
      ['difficult', row(5, 12, 3, 3)], ['wall', row(6, 13, 1)],
      ['difficult', row(13, 13, 3, 3)], ['wall', row(14, 14, 1)],
      ['difficult', row(20, 11, 3, 3)], ['wall', row(21, 12, 1)],
      ['water', row(0, 8, 9, 2)], ['water', row(9, 7, 6, 2)], ['water', row(15, 8, 9, 2)],
      ['difficult', row(10, 9, 2, 1)],
    ],
    labels: [[11, 9, 'Ford'], [12, 4, 'Clearing']],
  },
  corridor: {
    width: 30, height: 12, partyEdge: 'w',
    paint: [
      ['wall', row(0, 0, 30, 12)],
      // A long corridor with two side rooms and a pit.
      ['floor', row(0, 5, 30, 2)],
      ['floor', row(6, 1, 6, 4)], ['door', row(8, 4, 1)], ['wall', row(6, 4, 6)], ['door', row(8, 4, 1)],
      ['floor', row(18, 7, 8, 4)], ['wall', row(18, 7, 8)], ['door', row(21, 7, 1)],
      ['hazard', row(14, 5, 2, 2)],
      ['stairs', row(28, 5, 1, 2)],
    ],
    labels: [[8, 2, 'Guard room'], [21, 9, 'Shrine'], [14, 5, 'Pit 20 ft'], [28, 5, 'Stairs down']],
    fog: [row(18, 7, 8, 4), row(6, 1, 6, 4)],
  },
  field: {
    width: 24, height: 16, partyEdge: 's',
    paint: [
      ['difficult', row(2, 3, 2, 1)], ['difficult', row(19, 10, 3, 1)],
      ['wall', row(11, 7, 2, 2)],
    ],
    labels: [[11, 7, 'Boulder']],
  },
}

export function buildTemplate(id: TemplateId, mapId: string, ownerId: string, name: string, now: string): BattleMapDef {
  const tpl = TEMPLATES[id]
  let map = createMap(mapId, ownerId, name, now, tpl.width, tpl.height)
  for (const [terrain, rect] of tpl.paint) map = paintRect(map, rect, terrain)
  for (const [x, y, text] of tpl.labels) map = setLabel(map, { id: `${id}-${x}-${y}`, x, y, text })
  for (const rect of tpl.fog ?? []) map = coverFog(map, rect)
  return { ...map, partyEdge: tpl.partyEdge }
}
