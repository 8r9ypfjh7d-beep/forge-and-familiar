import { describe, expect, it } from 'vitest'
import { createEncounter, addCombatant } from './engine'
import {
  EMPTY_BOARD, healthOf, moveProblem, moveTokenOn, placeTokens, projectPublic, tokenLabel, toLiveEncounter,
  type LiveCombat,
} from './liveLogic'
import type { Board, Encounter, LiveMap } from './types'

const map: LiveMap = { id: 'm1', name: 'Tavern', width: 10, height: 8 }

function encounter(): Encounter {
  let e = createEncounter('e1', 'dm', 'Ambush', '2026-10-30T20:00:00.000Z')
  e = addCombatant(e, { id: 'vex', name: 'Vex Thorn', kind: 'pc', characterId: 'c-vex', initiative: 15, initBonus: 3 })
  e = addCombatant(e, { id: 'g1', name: 'Goblin', kind: 'npc', initiative: 12, initBonus: 2, hp: { current: 7, max: 7, temp: 0 }, ac: 15 })
  e = addCombatant(e, { id: 'g2', name: 'Goblin', kind: 'npc', initiative: 12, initBonus: 2, hp: { current: 3, max: 7, temp: 0 }, ac: 15 })
  e = addCombatant(e, { id: 'boss', name: 'Ogre', kind: 'npc', initiative: 8, initBonus: -1, hp: { current: 0, max: 59, temp: 0 } })
  return { ...e, log: ['something happened'] }
}

describe('health words', () => {
  it('bloodied at half HP or less, down at 0', () => {
    expect(healthOf({ current: 7, max: 7 })).toBe('healthy')
    expect(healthOf({ current: 4, max: 7 })).toBe('healthy')
    expect(healthOf({ current: 3, max: 7 })).toBe('bloodied')
    expect(healthOf({ current: 0, max: 7 })).toBe('down')
    expect(healthOf(undefined)).toBeUndefined()
  })
})

describe('token placement', () => {
  it('puts party members along the bottom and monsters along the top, sized by footprint', () => {
    const tokens = placeTokens(encounter(), map, c => c.id === 'boss' ? 2 : 1)
    expect(tokens.map(t => [t.label, t.x, t.y, t.size])).toEqual([
      ['VT', 0, 7, 1], ['G1', 0, 0, 1], ['G2', 2, 0, 1], ['O', 4, 0, 2],
    ])
    expect(tokens[0]!.characterId).toBe('c-vex')
    expect(tokens[1]!.characterId).toBeUndefined()
  })

  it('keeps tokens that exist and drops tokens of combatants that left', () => {
    const enc = encounter()
    const first = placeTokens(enc, map)
    const moved = { ...enc, board: { ...EMPTY_BOARD, tokens: moveTokenOn({ ...EMPTY_BOARD, tokens: first }, 'tok-vex', 5, 5).tokens } }
    const again = placeTokens({ ...moved, combatants: moved.combatants.filter(c => c.id !== 'g2') }, map)
    expect(again.find(t => t.id === 'tok-vex')).toMatchObject({ x: 5, y: 5 })
    expect(again.some(t => t.combatantId === 'g2')).toBe(false)
  })

  it('labels: initials for players, letter and number only when monsters share a name', () => {
    const enc = encounter()
    expect(tokenLabel(enc.combatants[0]!, enc.combatants)).toBe('VT')
    expect(tokenLabel(enc.combatants[3]!, enc.combatants)).toBe('O')
    expect(tokenLabel(enc.combatants[1]!, enc.combatants)).toBe('G1')
  })
})

describe('what players see', () => {
  const live = (board: Partial<Board>): LiveCombat => ({
    partyId: 'p1', encounter: toLiveEncounter(encounter()), map, rev: 3, startedAt: 't',
    board: { ...EMPTY_BOARD, tokens: placeTokens(encounter(), map), ...board },
  })

  it('strips the log, monster HP and the DM-only board bits', () => {
    const pub = projectPublic(live({ locked: true }))
    expect('log' in pub.encounter).toBe(false)
    const g1 = pub.encounter.combatants.find(c => c.id === 'g1')!
    expect(g1.hp).toBeUndefined()
    expect(g1.health).toBe('healthy')
    expect(pub.encounter.combatants.find(c => c.id === 'g2')!.health).toBe('bloodied')
    expect(pub.encounter.combatants.find(c => c.id === 'boss')!.health).toBe('down')
    expect(pub.encounter.combatants.find(c => c.id === 'vex')!.characterId).toBe('c-vex')
    expect(pub.board.locked).toBe(true)
  })

  it('hides hidden tokens and tokens under fog, with their combatants', () => {
    const l = live({ fog: ['2,0', '0,0'] })
    l.board.tokens = l.board.tokens.map(t => t.id === 'tok-boss' ? { ...t, hidden: true } : t)
    const pub = projectPublic(l)
    expect(pub.board.tokens.map(t => t.id)).toEqual(['tok-vex'])
    expect(pub.encounter.combatants.map(c => c.id)).toEqual(['vex'])
    expect(pub.board.tokens.every(t => !('hidden' in t))).toBe(true)
    expect(pub.board.fog).toEqual(['2,0', '0,0'])
  })
})

describe('who may move what', () => {
  const board: Board = { ...EMPTY_BOARD, tokens: placeTokens(encounter(), map, c => c.id === 'boss' ? 2 : 1) }
  const dm = { isDm: true }
  const vex = { isDm: false, characterId: 'c-vex' }
  const other = { isDm: false, characterId: 'c-bo' }

  it('the DM moves anything, a player only their own character', () => {
    expect(moveProblem(board, map, 'tok-g1', 1, 1, dm)).toBeNull()
    expect(moveProblem(board, map, 'tok-vex', 1, 1, vex)).toBeNull()
    expect(moveProblem(board, map, 'tok-g1', 1, 1, vex)).toBe('not-yours')
    expect(moveProblem(board, map, 'tok-vex', 1, 1, other)).toBe('not-yours')
    expect(moveProblem(board, map, 'nope', 1, 1, dm)).toBe('no-token')
  })

  it('a locked board stops players but not the DM', () => {
    const locked = { ...board, locked: true }
    expect(moveProblem(locked, map, 'tok-vex', 1, 1, vex)).toBe('locked')
    expect(moveProblem(locked, map, 'tok-vex', 1, 1, dm)).toBeNull()
  })

  it('nothing leaves the map, counting the footprint', () => {
    expect(moveProblem(board, map, 'tok-vex', 9, 7, dm)).toBeNull()
    expect(moveProblem(board, map, 'tok-vex', 10, 7, dm)).toBe('off-map')
    expect(moveProblem(board, map, 'tok-boss', 9, 7, dm)).toBe('off-map')
    expect(moveProblem(board, map, 'tok-boss', 8, 6, dm)).toBeNull()
    expect(moveProblem(board, map, 'tok-vex', -1, 0, dm)).toBe('off-map')
    expect(moveProblem(board, null, 'tok-vex', 99, 99, dm)).toBeNull()
  })
})
