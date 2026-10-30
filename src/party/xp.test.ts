import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { applyStash, getStash } from './stash'
import type { Party } from './types'
import { takeAwards } from './xp'

const party: Party = {
  id: 'p1', name: 'Garden Gang', code: 'GARDEN', dmId: 'dm',
  members: [
    { userId: 'dm', joinedAt: '2026-01-01T00:00:00Z' },
    { userId: 'roy', characterId: 'vex', joinedAt: '2026-01-01T00:00:00Z' },
    { userId: 'tamir', characterId: 'pip', joinedAt: '2026-01-01T00:00:00Z' },
  ],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}
const both = [{ userId: 'roy', characterId: 'vex' }, { userId: 'tamir', characterId: 'pip' }]
const vex = (xp: number, extra = {}) => makeCharacter({ id: 'vex', ownerId: 'roy', xp, classes: [{ classId: 'fighter', level: 2 }], ...extra })

function give(p: Party, by: string, action: { xp?: number; milestone?: boolean; to?: typeof both }) {
  const res = applyStash(p, by, { type: 'award', to: both, names: ['Vex', 'Pip'], ...action })
  if (!res.ok) throw new Error(res.reason)
  return res.party
}

describe('XP from the DM', () => {
  it('only the DM gives XP, to members who bring that character', () => {
    expect(applyStash(party, 'roy', { type: 'award', xp: 100, to: both, names: [] }).ok).toBe(false)
    const p = give(party, 'dm', { xp: 300, to: [...both, { userId: 'roy', characterId: 'other' }] })
    const [award] = getStash(p).awards!
    expect(award.to).toEqual(both)
    expect(getStash(p).log[0].text).toBe('gave 300 XP to Vex, Pip')
  })

  it('adds each award once, and other stash changes keep the awards', () => {
    let p = give(party, 'dm', { xp: 300 })
    const res = applyStash(p, 'roy', { type: 'coins', delta: { gp: 5 } })
    if (!res.ok) throw new Error(res.reason)
    p = res.party
    expect(getStash(p).awards).toHaveLength(1)
    const once = takeAwards(vex(400), [p])
    expect(once.xp).toBe(700)
    expect(takeAwards(once, [p])).toBe(once)
  })

  it('a milestone lifts XP to the next level, and two give two levels', () => {
    const p = give(give(party, 'dm', { milestone: true }), 'dm', { milestone: true })
    // Level 2: the next level needs 900, the one after 2700.
    expect(takeAwards(vex(400), [p]).xp).toBe(2700)
    expect(takeAwards(vex(5000), [give(party, 'dm', { milestone: true })]).xp).toBe(6500)
  })

  it('ignores awards for another player or character', () => {
    const p = give(party, 'dm', { xp: 300, to: [{ userId: 'tamir', characterId: 'pip' }] })
    const c = vex(0)
    expect(takeAwards(c, [p])).toBe(c)
  })
})
