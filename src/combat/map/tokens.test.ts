import { describe, expect, it } from 'vitest'
import { createMap, paintRect } from '../../maps/logic'
import { createEncounter } from '../engine'
import type { Combatant, Encounter } from '../types'
import { syncTokens } from './tokens'

const row = (id: string, kind: 'pc' | 'npc', name = id): Combatant => ({ id, name, kind, initiative: null, initBonus: 0, conditions: [], ...(kind === 'pc' ? { characterId: `ch-${id}` } : { hp: { current: 7, max: 7, temp: 0 } }) })
const enc = (rows: Combatant[], board?: Encounter['board']): Encounter => ({ ...createEncounter('e', 'dm', 'Fight', '2026-10-31T00:00:00Z'), combatants: rows, ...(board ? { board } : {}) })

describe('syncTokens', () => {
  const map = { ...createMap('m', 'dm', 'Field', '2026-10-31T00:00:00Z', 10, 8), partyEdge: 's' as const }

  it('puts the party on the party edge and monsters on the far row', () => {
    const tokens = syncTokens(enc([row('a', 'pc'), row('g', 'npc', 'Goblin'), row('b', 'pc')]), map, () => 1)
    expect(tokens.map(t => t.combatantId)).toEqual(['a', 'g', 'b'])
    expect(tokens.filter(t => t.kind === 'pc').every(t => t.y === 7)).toBe(true)
    expect(tokens.find(t => t.kind === 'npc')!.y).toBe(0)
    expect(new Set(tokens.map(t => `${t.x},${t.y}`)).size).toBe(3)
  })

  it('keeps tokens already placed and drops those whose combatant left', () => {
    const first = syncTokens(enc([row('a', 'pc'), row('g', 'npc')]), map, () => 1)
    const moved = first.map(t => (t.combatantId === 'a' ? { ...t, x: 4, y: 4 } : t))
    const next = syncTokens(enc([row('a', 'pc'), row('o', 'npc', 'Orc')], { tokens: moved, fog: [], locked: false }), map, () => 1)
    expect(next.find(t => t.combatantId === 'a')).toMatchObject({ x: 4, y: 4 })
    expect(next.some(t => t.combatantId === 'g')).toBe(false)
    expect(next.some(t => t.combatantId === 'o')).toBe(true)
  })

  it('benches a monster whose far-row spot is a wall, and sizes big ones', () => {
    const walled = paintRect(map, { x: 0, y: 0, w: 10, h: 1 }, 'wall')
    const tokens = syncTokens(enc([row('d', 'npc', 'Dragon')]), walled, () => 3)
    expect(tokens[0]).toMatchObject({ x: -1, y: -1, size: 3 })
  })
})
