import { describe, expect, it } from 'vitest'
import type { LiveCombat } from '../../combat/liveLogic'
import type { Party } from '../../party/types'
import { bringsCharacter, canMoveTo, mapStatus, ownToken, tokenHealth } from './liveMap'

const live: LiveCombat = {
  partyId: 'p1',
  encounter: {
    id: 'e1', name: 'Ambush', round: 2, activeId: 'c-vex',
    combatants: [
      { id: 'c-vex', name: 'Vex', kind: 'pc', characterId: 'ch-vex', initiative: 18, conditions: [], hp: { current: 12, max: 30, temp: 0 }, active: true },
      { id: 'c-gob', name: 'Goblin', kind: 'npc', initiative: 10, conditions: [], look: 'bloodied', active: false },
    ],
    effects: [], updatedAt: '',
  },
  map: { id: 'm1', name: 'Clearing', width: 10, height: 8 },
  board: {
    tokens: [
      { id: 'tok-vex', combatantId: 'c-vex', characterId: 'ch-vex', kind: 'pc', label: 'V', x: 1, y: 7, size: 1 },
      { id: 'tok-gob', combatantId: 'c-gob', kind: 'npc', label: 'G1', x: 4, y: 0, size: 1 },
    ],
    fog: [], locked: false,
  },
  rev: 3, startedAt: '',
}
const party: Party = {
  id: 'p1', name: 'Garden Gang', code: 'ABCDEF', dmId: 'dm', createdAt: '', updatedAt: '',
  members: [{ userId: 'dm', joinedAt: '' }, { userId: 'roy', characterId: 'ch-vex', joinedAt: '' }],
}

describe('sheet map tab', () => {
  it('finds the token of the character the player brings', () => {
    expect(ownToken(live, 'ch-vex')?.id).toBe('tok-vex')
    expect(ownToken(live, 'ch-other')).toBeUndefined()
    expect(bringsCharacter(party, 'roy', 'ch-vex')).toBe(true)
    expect(bringsCharacter(party, 'roy', 'ch-other')).toBe(false)
    expect(bringsCharacter(undefined, 'roy', 'ch-vex')).toBe(false)
  })

  it('says whose turn it is and whether this player may move', () => {
    const s = mapStatus(live, 'ch-vex', true)
    expect(s.round).toBe(2)
    expect(s.active?.name).toBe('Vex')
    expect(s.yourTurn).toBe(true)
    expect(s.cantMove).toBeNull()
    expect(s.ownTokenId).toBe('tok-vex')
    expect(mapStatus({ ...live, board: { ...live.board, locked: true } }, 'ch-vex', true).cantMove).toBe('locked')
    // A sheet of a character the player doesn't bring: nothing to move.
    expect(mapStatus(live, 'ch-vex', false).cantMove).toBe('not-yours')
    expect(mapStatus(live, 'ch-other', true).cantMove).toBe('no-token')
    expect(mapStatus(live, 'ch-other', true).yourTurn).toBe(false)
  })

  it('checks a move like the server does', () => {
    expect(canMoveTo(live, 'ch-vex', 'tok-vex', 2, 6)).toBeNull()
    expect(canMoveTo(live, 'ch-vex', 'tok-gob', 2, 6)).toBe('not-yours')
    expect(canMoveTo(live, 'ch-vex', 'tok-vex', 10, 6)).toBe('off-map')
  })

  it('shows exact HP on party tokens and only a health word on monsters', () => {
    expect(tokenHealth(live, live.board.tokens[0]!)).toEqual({ hp: { current: 12, max: 30 } })
    expect(tokenHealth(live, live.board.tokens[1]!)).toEqual({ health: 'bloodied' })
  })
})
