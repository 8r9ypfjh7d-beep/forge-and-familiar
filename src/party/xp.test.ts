import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { applyStash, getStash } from './stash'
import type { Party } from './types'
import { levelAfter, partyLevels, partyTop, pendingLevel, takeAwards } from './xp'
import { parseStashLog } from './stash'

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

function give(p: Party, by: string, action: { xp?: number; milestone?: boolean; level?: number; to?: typeof both }) {
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

describe('Levelling up the whole party', () => {
  const pip = (xp: number, level: number, extra = {}) => makeCharacter({ id: 'pip', ownerId: 'tamir', xp, classes: [{ classId: 'wizard', level }], ...extra })

  it('a catch-up lifts XP to that level, keeps more XP, and logs a readable line', () => {
    const p = give(party, 'dm', { milestone: true, level: 5, to: [both[1]] })
    expect(getStash(p).awards![0]).toMatchObject({ milestone: true, level: 5 })
    expect(takeAwards(pip(0, 1), [p]).xp).toBe(6500)
    expect(takeAwards(pip(9000, 5), [p]).xp).toBe(9000)
    expect(parseStashLog(getStash(p).log[0].text)).toEqual({ kind: 'toLevel', who: 'Vex, Pip', level: 5 })
    expect(applyStash(party, 'dm', { type: 'award', level: 21, to: both, names: [] }).ok).toBe(false)
  })

  it('tracks each player from sent to choosing to done', () => {
    const p = give(party, 'dm', { milestone: true })
    const before = { vex: vex(300), pip: undefined }
    const sent = partyLevels(p, before)
    expect(sent.map(r => r.status)).toEqual(['sent', 'unknown'])
    expect(levelAfter(sent[0])).toBe(3)
    const took = takeAwards(vex(300), [p])
    expect(partyLevels(p, { vex: took })[0]).toMatchObject({ status: 'choosing', level: 2, xpLevel: 3 })
    const levelled = { ...took, classes: [{ classId: 'fighter', level: 3 }] }
    expect(partyLevels(p, { vex: levelled })[0].status).toBe('done')
    expect(partyLevels(party, { vex: vex(300) })[0].status).toBe('idle')
  })

  it('the party top counts levels still on their way', () => {
    const p = give(party, 'dm', { milestone: true, to: [both[0]] })
    const rows = partyLevels(p, { vex: vex(300), pip: pip(0, 1) })
    expect(partyTop(rows)).toBe(3)
  })

  it('asks the player once their device took a level, for the next level only', () => {
    const p = give(give(party, 'dm', { milestone: true }), 'dm', { milestone: true })
    expect(pendingLevel(vex(300), [p])).toBeUndefined()
    const took = takeAwards(vex(300), [p])
    expect(pendingLevel(took, [p])).toMatchObject({ level: 3, party: { id: 'p1' } })
    const levelled = { ...took, classes: [{ classId: 'fighter', level: 3 }] }
    expect(pendingLevel(levelled, [p])?.level).toBe(4)
    expect(pendingLevel({ ...levelled, classes: [{ classId: 'fighter', level: 4 }] }, [p])).toBeUndefined()
  })
})
