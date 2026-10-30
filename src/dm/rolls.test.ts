import { describe, expect, it } from 'vitest'
import type { RollResult } from '../dice'
import type { Party } from '../party/types'
import { filterRolls, mergeDmRolls, playerSummary, unseenCount } from './rolls'

const roll = (id: string, over: Partial<RollResult> = {}): RollResult => ({
  id, notation: '1d20+3', type: 'skill', total: 15, terms: [], breakdown: '[12] + 3', timestamp: `2026-10-30T20:${id.padStart(2, '0')}:00.000Z`,
  roller: { characterId: 'char-roy', characterName: 'Vex' }, ...over,
})

const party: Party = {
  id: 'p1', name: 'Garden Gang', code: 'GARDEN', dmId: 'noa', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  members: [
    { userId: 'noa', joinedAt: '2026-10-01T00:00:00.000Z' },
    { userId: 'roy', characterId: 'char-roy', joinedAt: '2026-10-01T00:00:00.000Z' },
    { userId: 'tamir', characterId: 'char-tamir', joinedAt: '2026-10-30T20:05:00.000Z' },
  ],
}

describe('DM roll log', () => {
  const histories = {
    roy: [roll('9'), roll('3', { type: 'attack', d20: { mode: 'normal', natural: 20, crit: true, fumble: false } })],
    tamir: [
      roll('7', { roller: { characterId: 'char-tamir', characterName: 'Goku' }, type: 'save', d20: { mode: 'normal', natural: 1, crit: false, fumble: true } }),
      roll('1', { roller: { characterId: 'char-tamir', characterName: 'Goku' } }), // before Tamir joined
    ],
    noa: [roll('8', { roller: { characterId: 'npc', characterName: 'Goblin' } })],
  }
  const secrets = [
    { roll: roll('5', { label: 'Stealth' }), fromUserId: 'roy' },
    { roll: roll('6'), fromUserId: 'stranger' },
  ]

  it('merges public and secret rolls, newest first, skipping the DM, strangers and pre-join rolls', () => {
    const log = mergeDmRolls(party, histories, secrets)
    expect(log.map(e => `${e.roll.id}${e.secret ? '*' : ''}`)).toEqual(['9', '7', '5*', '3'])
    expect(log.find(e => e.roll.id === '5')?.userId).toBe('roy')
  })

  it('filters by player and by kind', () => {
    const log = mergeDmRolls(party, histories, secrets)
    expect(filterRolls(log, { userId: 'tamir' }).map(e => e.roll.id)).toEqual(['7'])
    expect(filterRolls(log, { kind: 'attacks' }).map(e => e.roll.id)).toEqual(['3'])
    expect(filterRolls(log, { kind: 'saves' }).map(e => e.roll.id)).toEqual(['7'])
    expect(filterRolls(log, { kind: 'checks' }).map(e => e.roll.id)).toEqual(['9', '5'])
    expect(filterRolls(log, { kind: 'secret' }).map(e => e.roll.id)).toEqual(['5'])
    expect(filterRolls(log, { userId: 'roy', kind: 'secret' }).map(e => e.roll.id)).toEqual(['5'])
  })

  it('summarises each player who brings a character', () => {
    const log = mergeDmRolls(party, histories, secrets)
    expect(playerSummary(party, log)).toEqual([
      { userId: 'roy', count: 3, lastAt: '2026-10-30T20:09:00.000Z', crits: 1, fumbles: 0 },
      { userId: 'tamir', count: 1, lastAt: '2026-10-30T20:07:00.000Z', crits: 0, fumbles: 1 },
    ])
  })

  it('counts rolls since the DM last looked, none before the first look', () => {
    const log = mergeDmRolls(party, histories, secrets)
    expect(unseenCount(log, undefined)).toBe(0)
    expect(unseenCount(log, '2026-10-30T20:06:30.000Z')).toBe(2)
    expect(unseenCount(log, '2026-10-30T20:09:00.000Z')).toBe(0)
  })

  it('caps the log', () => {
    const many = { roy: Array.from({ length: 30 }, (_, i) => roll(String(i + 10))) }
    expect(mergeDmRolls(party, many, [], 5)).toHaveLength(5)
  })
})
