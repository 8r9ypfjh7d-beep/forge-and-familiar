import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { getReactions, lowestFreeSlot, reactionBlocker } from './reactions'

const ids = (c: Parameters<typeof getReactions>[0]) => getReactions(c).map(r => r.id)
const inv = (...itemIds: string[]) => itemIds.map((itemId, i) => ({ uid: `u${i}`, itemId, qty: 1, equipped: true }))

describe('getReactions', () => {
  it('gives everyone an opportunity attack with their melee weapon', () => {
    const c = makeCharacter({ classes: [{ classId: 'fighter', level: 3 }], inventory: inv('longbow', 'longsword') })
    const oa = getReactions(c)[0]
    expect(oa.id).toBe('opportunity-attack')
    expect(oa.effect).toContain('Longsword')
    expect(oa.effect).not.toContain('Longbow')
  })

  it('falls back to an unarmed strike', () => {
    const c = makeCharacter({ classes: [{ classId: 'fighter', level: 1 }] })
    expect(getReactions(c)[0].effect).toContain('Unarmed Strike')
  })

  it('adds Shield and Feather Fall for a wizard, with the Shield AC', () => {
    const c = makeCharacter({ classes: [{ classId: 'wizard', level: 1 }] })
    expect(ids(c)).toEqual(['opportunity-attack', 'shield', 'feather-fall'])
    const shield = getReactions(c).find(r => r.id === 'shield')!
    expect(shield.effect).toMatch(/AC (\d+) → (\d+)/)
    const [, from, to] = shield.effect.match(/AC (\d+) → (\d+)/)!
    expect(Number(to) - Number(from)).toBe(5)
  })

  it('adds Counterspell only once 3rd-level slots exist', () => {
    expect(ids(makeCharacter({ classes: [{ classId: 'sorcerer', level: 4 }] }))).not.toContain('counterspell')
    expect(ids(makeCharacter({ classes: [{ classId: 'sorcerer', level: 5 }] }))).toContain('counterspell')
  })

  it('gives warlocks Hellish Rebuke on pact slots', () => {
    const c = makeCharacter({ classes: [{ classId: 'warlock', level: 1 }] })
    expect(ids(c)).toEqual(['opportunity-attack', 'hellish-rebuke'])
  })

  it('marks a spell not ready when its slots are spent', () => {
    const c = makeCharacter({ classes: [{ classId: 'wizard', level: 1 }] })
    const spent = { ...c, state: { ...c.state, spellSlotsUsed: [2, 0, 0, 0, 0, 0, 0, 0, 0] } }
    const shield = getReactions(spent).find(r => r.id === 'shield')!
    expect(shield.ready).toBe(false)
    expect(shield.note).toMatch(/No 1st-level/)
  })

  it('adds rogue and monk features at their levels', () => {
    expect(ids(makeCharacter({ classes: [{ classId: 'rogue', level: 4 }] }))).toEqual(['opportunity-attack'])
    expect(ids(makeCharacter({ classes: [{ classId: 'rogue', level: 5 }] }))).toContain('uncanny-dodge')
    const monk = makeCharacter({ classes: [{ classId: 'monk', level: 4 }], baseAbilities: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 } })
    const r = getReactions(monk)
    expect(r.find(x => x.id === 'deflect-missiles')!.effect).toContain('1d10+7')
    expect(r.find(x => x.id === 'slow-fall')!.effect).toContain('20')
  })
})

describe('lowestFreeSlot', () => {
  it('upcasts with the next free slot', () => {
    const c = makeCharacter({ classes: [{ classId: 'wizard', level: 3 }] })
    expect(lowestFreeSlot(c, 1)).toEqual({ level: 1, pact: false })
    const spent = { ...c, state: { ...c.state, spellSlotsUsed: [4, 0, 0, 0, 0, 0, 0, 0, 0] } }
    expect(lowestFreeSlot(spent, 1)).toEqual({ level: 2, pact: false })
  })

  it('uses pact slots', () => {
    const c = makeCharacter({ classes: [{ classId: 'warlock', level: 3 }] })
    expect(lowestFreeSlot(c, 1)).toEqual({ level: 2, pact: true })
    expect(lowestFreeSlot({ ...c, state: { ...c.state, pactSlotsUsed: 2 } }, 1)).toBeNull()
  })
})

describe('reactionBlocker', () => {
  it('blocks at 0 HP and when incapacitated, not when prone', () => {
    const c = makeCharacter()
    expect(reactionBlocker(c)).toBeNull()
    expect(reactionBlocker({ ...c, state: { ...c.state, currentHp: 0 } })).toMatch(/0 HP/)
    expect(reactionBlocker({ ...c, state: { ...c.state, conditions: ['stunned'] } })).toBe('Stunned')
    expect(reactionBlocker({ ...c, state: { ...c.state, conditions: ['prone'] } })).toBeNull()
  })
})
