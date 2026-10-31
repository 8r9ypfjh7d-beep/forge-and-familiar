import { describe, expect, it } from 'vitest'
import type { Party } from '../party/types'
import { createEncounter } from './engine'
import type { Combatant } from './types'
import { fightCreatures, fightPlayers, xpShare } from './xp'

const row = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, kind: 'npc', initiative: 10, initBonus: 0, conditions: [], ...over })

const enc = () => ({
  ...createEncounter('e1', 'dm', 'Fight 1', '2026-10-31T00:00:00Z'),
  combatants: [
    row('Goblin 1', { hp: { current: 0, max: 7, temp: 0 } }),
    row('Goblin 2', { hp: { current: 3, max: 7, temp: 0 } }),
    row('Commoner'),
    row('Roy', { kind: 'pc', characterId: 'c-roy' }),
  ],
})

describe('xp after a fight', () => {
  it('lists the creatures worth XP and ticks the beaten ones', () => {
    const xp = (c: Combatant) => (c.name.startsWith('Goblin') ? 50 : 0)
    const down = (c: Combatant) => (c.hp?.current ?? 1) <= 0
    expect(fightCreatures(enc(), xp, down)).toEqual([
      { id: 'Goblin 1', name: 'Goblin 1', xp: 50, beaten: true },
      { id: 'Goblin 2', name: 'Goblin 2', xp: 50, beaten: false },
    ])
  })

  it('shares between the players whose characters fought, else every player', () => {
    const party = {
      dmId: 'noa',
      members: [{ userId: 'noa', characterId: 'c-dm' }, { userId: 'roy', characterId: 'c-roy' }, { userId: 'maayan', characterId: 'c-maayan' }, { userId: 'tamir' }],
    } as unknown as Party
    expect(fightPlayers(party, enc())).toEqual([{ userId: 'roy', characterId: 'c-roy' }])
    expect(fightPlayers(party, { ...enc(), combatants: [] })).toEqual([
      { userId: 'roy', characterId: 'c-roy' }, { userId: 'maayan', characterId: 'c-maayan' },
    ])
  })

  it('splits evenly, rounding down', () => {
    expect(xpShare(150, 2)).toBe(75)
    expect(xpShare(100, 3)).toBe(33)
    expect(xpShare(100, 0)).toBe(0)
  })
})
