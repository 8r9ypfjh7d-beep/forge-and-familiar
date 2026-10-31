import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  autoPlace, checkMove, coverFog, createMap, distanceFeet, findPath, fitPicture, footprintOf, gridFromPicture, isCovered, normalizeMap,
  paintCell, paintRect, publicTokens, rectBetween, removeLabel, resizeMap, revealFog, setLabel, setPicture, terrainAt, toggleDoor,
  tokenDistanceFeet, UNPLACED,
} from './logic'
import { buildTemplate, TEMPLATE_IDS } from './templates'
import type { Board, LiveMap } from '../combat/types'
import { coverCells, revealCells } from './logic'
import type { BattleMapDef, MapToken } from './types'

const NOW = '2026-10-30T20:00:00.000Z'
const blank = (w = 10, h = 10) => createMap('m1', 'noa', 'Test', NOW, w, h)
const token = (id: string, x: number, y: number, extra: Partial<MapToken> = {}): MapToken =>
  ({ id, combatantId: id, kind: 'pc', label: id.slice(0, 2).toUpperCase(), x, y, size: 1, hidden: false, ...extra })

describe('grid and painting', () => {
  it('clamps the size and keeps floor out of the sparse terrain', () => {
    const m = createMap('m', 'noa', 'Big', NOW, 999, 1)
    expect([m.width, m.height]).toEqual([60, 5])
    const painted = paintCell(paintCell(blank(), 2, 2, 'wall'), 2, 2, 'floor')
    expect(painted.terrain).toEqual({})
  })

  it('paints rectangles inside the grid only', () => {
    const m = paintRect(blank(), rectBetween({ x: 8, y: 8 }, { x: 12, y: 12 }), 'difficult')
    expect(Object.keys(m.terrain)).toHaveLength(4)
    expect(terrainAt(m, 9, 9)).toBe('difficult')
    expect(terrainAt(m, 7, 7)).toBe('floor')
  })

  it('toggles doors open and closed', () => {
    const m = paintCell(blank(), 1, 1, 'door')
    expect(terrainAt(toggleDoor(m, 1, 1), 1, 1)).toBe('doorOpen')
    expect(terrainAt(toggleDoor(toggleDoor(m, 1, 1), 1, 1), 1, 1)).toBe('door')
    expect(toggleDoor(m, 2, 2)).toBe(m)
  })

  it('keeps one label per cell and drops empty text', () => {
    let m = setLabel(blank(), { id: 'a', x: 1, y: 1, text: ' Altar ' })
    m = setLabel(m, { id: 'b', x: 1, y: 1, text: 'Pit' })
    expect(m.labels).toEqual([{ id: 'b', x: 1, y: 1, text: 'Pit' }])
    expect(setLabel(m, { id: 'b', x: 1, y: 1, text: '' }).labels).toEqual([])
    expect(removeLabel(m, 'b').labels).toEqual([])
  })

  it('resizing keeps what still fits', () => {
    let m = paintCell(paintCell(blank(10, 10), 1, 1, 'wall'), 8, 8, 'wall')
    m = setLabel(m, { id: 'l', x: 9, y: 0, text: 'Far' })
    m = coverFog(m, { x: 7, y: 7, w: 3, h: 3 })
    const small = resizeMap(m, 6, 6)
    expect(small.terrain).toEqual({ '1,1': 'wall' })
    expect(small.labels).toEqual([])
    expect(small.fog).toEqual([])
  })
})

describe('fog', () => {
  it('covers and reveals cells and hides tokens under it from players', () => {
    let m = coverFog(blank(), { x: 0, y: 0, w: 3, h: 3 })
    expect(isCovered(m, 2, 2)).toBe(true)
    expect(m.fog).toHaveLength(9)
    m = revealFog(m, { x: 0, y: 0, w: 1, h: 3 })
    expect(m.fog).toHaveLength(6)
    expect(isCovered(m, 0, 1)).toBe(false)
    const tokens = [token('a', 0, 0), token('b', 2, 2), token('c', 5, 5, { hidden: true }), token('d', 5, 6)]
    expect(publicTokens(m, tokens).map(t => t.id)).toEqual(['a', 'd'])
  })
})

describe('pictures', () => {
  it('sizes the grid to the picture and refits when the cell size changes', () => {
    const m = setPicture(blank(), { src: 'data:', width: 2048, height: 1024 }, 32)
    expect(m.picture?.cell).toBe(64)
    expect([m.width, m.height]).toEqual([32, 16])
    const refit = fitPicture(m, { cell: 128, offsetX: 100 })
    expect([refit.width, refit.height]).toEqual([15, 8])
    expect(gridFromPicture({ width: 100, height: 100, cell: 1, offsetX: 0, offsetY: 0 })).toEqual({ width: 60, height: 60 })
  })
})

describe('distances and footprints', () => {
  it('counts diagonals as 5 ft, or 5-10-5 with the variant', () => {
    expect(distanceFeet({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(15)
    expect(distanceFeet({ x: 0, y: 0 }, { x: 3, y: 3 }, '5-10-5')).toBe(20)
    expect(distanceFeet({ x: 0, y: 0 }, { x: 4, y: 1 }, '5-10-5')).toBe(20)
  })

  it('measures reach edge to edge for big creatures', () => {
    const ogre = token('o', 2, 2, { size: 2 })
    expect(tokenDistanceFeet(token('a', 0, 0), ogre)).toBe(10)
    expect(tokenDistanceFeet(token('a', 1, 1), ogre)).toBe(5)
    expect(tokenDistanceFeet(token('a', 4, 2), ogre)).toBe(5)
    expect(tokenDistanceFeet(token('a', 5, 5), ogre)).toBe(10)
  })

  it('maps creature sizes to footprints', () => {
    expect(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan', undefined].map(footprintOf)).toEqual([1, 1, 1, 2, 3, 4, 1])
  })
})

describe('paths', () => {
  it('walks straight across open floor', () => {
    const r = findPath(blank(), { x: 0, y: 0 }, { x: 4, y: 0 })!
    expect(r.cost).toBe(20)
    expect(r.path).toHaveLength(5)
  })

  it('goes round walls and never squeezes between two corners', () => {
    let m = paintRect(blank(), { x: 2, y: 0, w: 1, h: 9 }, 'wall')
    const r = findPath(m, { x: 0, y: 0 }, { x: 4, y: 0 })!
    expect(r.cost).toBe(100)
    m = paintCell(paintCell(blank(), 1, 0, 'wall'), 0, 1, 'wall')
    expect(findPath(m, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull()
  })

  it('charges double for difficult terrain and water, and blocks on closed doors only', () => {
    const m = paintRect(blank(), { x: 1, y: 0, w: 2, h: 10 }, 'difficult')
    expect(findPath(m, { x: 0, y: 0 }, { x: 3, y: 0 })!.cost).toBe(25)
    const wet = paintRect(blank(), { x: 1, y: 0, w: 1, h: 10 }, 'water')
    expect(findPath(wet, { x: 0, y: 0 }, { x: 2, y: 0 })!.cost).toBe(15)
    const door = paintCell(paintRect(blank(5, 10), { x: 0, y: 5, w: 5, h: 1 }, 'wall'), 0, 5, 'door')
    expect(findPath(door, { x: 0, y: 0 }, { x: 0, y: 9 })).toBeNull()
    expect(findPath(toggleDoor(door, 0, 5), { x: 0, y: 0 }, { x: 0, y: 9 })!.cost).toBe(45)
  })

  it('counts every second diagonal as 10 ft under the variant', () => {
    const m: BattleMapDef = { ...blank(), diagonals: '5-10-5' }
    expect(findPath(m, { x: 0, y: 0 }, { x: 3, y: 3 })!.cost).toBe(20)
    expect(findPath(m, { x: 0, y: 0 }, { x: 1, y: 1 })!.cost).toBe(5)
  })

  it('does not pass through other tokens, and big tokens need their whole footprint free', () => {
    const m = paintRect(blank(), { x: 2, y: 0, w: 1, h: 9 }, 'wall')
    const blocker = token('b', 2, 9)
    expect(findPath(m, { x: 0, y: 0 }, { x: 4, y: 0 }, { tokens: [blocker], moverId: 'a' })).toBeNull()
    const gap = paintRect(blank(), { x: 2, y: 0, w: 1, h: 9 }, 'wall')
    expect(findPath(gap, { x: 0, y: 0 }, { x: 4, y: 0 }, { size: 2 })).toBeNull()
    expect(findPath(gap, { x: 0, y: 0 }, { x: 4, y: 0 }, { size: 1 })).not.toBeNull()
  })

  it('stops looking past the cost limit', () => {
    expect(findPath(blank(), { x: 0, y: 0 }, { x: 9, y: 0 }, { maxCost: 20 })).toBeNull()
  })
})

describe('checkMove', () => {
  const m = paintCell(blank(), 3, 0, 'wall')
  const me = token('a', 0, 0)
  const other = token('b', 1, 1)

  it('names why a move is refused', () => {
    expect(checkMove(m, [me, other], me, { x: -1, y: 0 }).problem).toBe('outside')
    expect(checkMove(m, [me, other], me, { x: 3, y: 0 }).problem).toBe('blocked')
    expect(checkMove(m, [me, other], me, { x: 1, y: 1 }).problem).toBe('occupied')
    const boxed = paintRect(paintRect(blank(), { x: 0, y: 1, w: 2, h: 1 }, 'wall'), { x: 1, y: 0, w: 1, h: 1 }, 'wall')
    expect(checkMove(boxed, [me], me, { x: 5, y: 5 }).problem).toBe('unreachable')
  })

  it('allows a move past the budget but flags it', () => {
    const ok = checkMove(m, [me, other], me, { x: 0, y: 4 }, 30)
    expect(ok).toMatchObject({ ok: true, cost: 20, overBudget: false })
    expect(checkMove(m, [me, other], me, { x: 0, y: 8 }, 30)).toMatchObject({ ok: true, cost: 40, overBudget: true })
  })
})

describe('autoPlace', () => {
  it('lines unplaced tokens along the party edge and leaves placed ones alone', () => {
    const m: BattleMapDef = { ...paintCell(blank(10, 10), 5, 9, 'wall'), partyEdge: 's' }
    const tokens = [token('a', UNPLACED, UNPLACED), token('b', UNPLACED, UNPLACED, { size: 2 }), token('c', 2, 2)]
    const placed = autoPlace(m, tokens)
    expect(placed[2]).toEqual(tokens[2])
    // The wall sits on the middle cell, so the first token lands beside it and the ogre hangs inwards from the edge.
    expect(placed[0]).toMatchObject({ x: 4, y: 9 })
    expect(placed[1]).toMatchObject({ x: 6, y: 8 })
    const cells = placed.flatMap(t => [`${t.x},${t.y}`])
    expect(new Set(cells).size).toBe(3)
  })

  it('uses the west edge when asked', () => {
    const m: BattleMapDef = { ...blank(10, 10), partyEdge: 'w' }
    expect(autoPlace(m, [token('a', UNPLACED, UNPLACED)])[0]).toMatchObject({ x: 0, y: 5 })
  })
})

describe('normalizeMap', () => {
  it('drops junk and fills defaults', () => {
    const raw = {
      id: 'x', ownerId: 'noa', width: 8, height: 200, terrain: { '1,1': 'wall', '99,99': 'wall', '2,2': 'lava', '3,3': 'floor' },
      labels: [{ id: 'l', x: 1, y: 1, text: 'ok' }, { x: 1 }], fog: ['0,0', '0,0', '77,1', 3], diagonals: 'hex', partyEdge: 'up',
    }
    const m = normalizeMap(raw)!
    expect([m.width, m.height]).toEqual([8, 60])
    expect(m.terrain).toEqual({ '1,1': 'wall' })
    expect(m.labels).toHaveLength(1)
    expect(m.fog).toEqual(['0,0'])
    expect(m.diagonals).toBe('5')
    expect(m.partyEdge).toBeUndefined()
    expect(m.schemaVersion).toBe(1)
    expect(normalizeMap(null)).toBeNull()
    expect(normalizeMap({ id: 'x' })).toBeNull()
  })

  it('round-trips a template', () => {
    const t = buildTemplate('corridor', 'c', 'noa', 'Corridor', NOW)
    expect(normalizeMap(JSON.parse(JSON.stringify(t)))).toEqual(t)
  })
})

describe('templates', () => {
  it('builds four walkable maps with a party edge', () => {
    for (const id of TEMPLATE_IDS) {
      const m = buildTemplate(id, id, 'noa', id, NOW)
      expect(m.partyEdge).toBeDefined()
      const placed = autoPlace(m, [token('a', UNPLACED, UNPLACED), token('b', UNPLACED, UNPLACED)])
      expect(`${placed[0].x},${placed[0].y}`).not.toBe(`${placed[1].x},${placed[1].y}`)
      // The two stand next to each other on open ground: one can step to the other's side.
      expect(findPath(m, { x: placed[0].x, y: placed[0].y }, { x: placed[1].x, y: placed[1].y }, { tokens: placed, moverId: 'a' })).toBeNull()
      expect(findPath(m, { x: placed[0].x, y: placed[0].y }, { x: placed[1].x, y: placed[1].y }, { moverId: 'a' })).not.toBeNull()
    }
  })

  it('the corridor leads from the party edge to the stairs', () => {
    const m = buildTemplate('corridor', 'c', 'noa', 'Corridor', NOW)
    const r = findPath(m, { x: 0, y: 5 }, { x: 28, y: 5 })
    expect(r?.cost).toBeGreaterThanOrEqual(140)
  })
})

describe('maps.css', () => {
  it('uses logical properties and glass tokens', () => {
    const css = readFileSync(new URL('./maps.css', import.meta.url), 'utf8')
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|[^-]\b(left|right):/)
    expect(css).toMatch(/--glass-/)
  })
})

describe('live combat hand-off', () => {
  it('passes a saved map as the live map and edits the board fog with the same helpers', () => {
    const map = buildTemplate('corridor', 'c', 'noa', 'Corridor', NOW)
    const live: LiveMap = map
    expect(live.fog).toEqual(map.fog)
    const board: Board = { mapId: map.id, tokens: [], fog: map.fog, locked: false }
    const revealed = revealCells(board.fog, { x: 18, y: 7, w: 8, h: 4 })
    expect(revealed.length).toBeLessThan(board.fog.length)
    expect(coverCells(revealed, { x: 18, y: 7, w: 8, h: 4 }, map)).toEqual(board.fog)
  })
})

describe('map names', () => {
  it('shows stock names in the current language and keeps the DM\'s own names', async () => {
    const { mapName } = await import('./names')
    const { translate } = await import('../i18n')
    const he = (key: Parameters<typeof translate>[1]) => translate('he', key)
    expect(mapName('Tavern', he)).toBe(translate('he', 'maps.tpl.tavern'))
    expect(mapName('Forest clearing', he)).toBe(translate('he', 'maps.tpl.forest'))
    expect(mapName(translate('he', 'maps.tpl.field'), k => translate('en', k))).toBe('Open field')
    expect(mapName('', he)).toBe(translate('he', 'maps.untitled'))
    expect(mapName('Goblin cave', he)).toBe('Goblin cave')
  })
})
