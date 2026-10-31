import { describe, expect, it } from 'vitest'
import { metamagicCount } from '../rules'
import { createSlot, slotToPoints, sorceryLeft, sorceryPools, spendSorcery } from './fontOfMagic'
import { makeCharacter } from './fixtures'

const sorc = (over: Parameters<typeof makeCharacter>[0] = {}) => {
  const c = makeCharacter({ classes: [{ classId: 'sorcerer', level: 5 }], ...over })
  return { ...c, state: { ...c.state, spellSlotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0], ...over.state } }
}
const used = (c: ReturnType<typeof sorc>, id = 'sorcery-points') => c.state.resources[id]?.used ?? 0

describe('Font of Magic and sorcery point spending', () => {
  it('spends points and refuses when there are not enough', () => {
    const c = sorc()
    expect(sorceryLeft(c)).toBe(5)
    expect(used(spendSorcery(c, 3)!)).toBe(3)
    expect(spendSorcery(c, 6)).toBeUndefined()
  })

  it('buys back an expended slot at the Font of Magic price', () => {
    const c = sorc({ state: { ...sorc().state, spellSlotsUsed: [0, 0, 1, 0, 0, 0, 0, 0, 0] } })
    expect(createSlot(sorc(), 3)).toBeUndefined() // nothing expended
    const made = createSlot(c, 3)!
    expect(made.state.spellSlotsUsed[2]).toBe(0)
    expect(used(made)).toBe(5)
    expect(createSlot(made, 3)).toBeUndefined()
  })

  it('turns an unused slot into points, only when points are spent', () => {
    expect(slotToPoints(sorc(), 2)).toBeUndefined() // pool is full
    const tired = spendSorcery(sorc(), 4)!
    const back = slotToPoints(tired, 2)!
    expect(back.state.spellSlotsUsed[1]).toBe(1)
    expect(used(back)).toBe(2)
  })

  it('adds Metamagic Adept: two more options and two more points, also for non-sorcerers', () => {
    const adept = { improvements: [{ classId: 'sorcerer', level: 4, featId: 'metamagic-adept' }] }
    expect(metamagicCount({ classes: [{ classId: 'sorcerer', level: 5 }], ...adept })).toBe(4)
    const wiz = makeCharacter({ classes: [{ classId: 'wizard', level: 4 }], improvements: [{ classId: 'wizard', level: 4, featId: 'metamagic-adept' }] })
    expect(metamagicCount(wiz)).toBe(2)
    expect(sorceryPools(wiz).map(p => [p.id, p.max])).toEqual([['feat:metamagic-adept', 2]])
    const both = sorc(adept)
    expect(sorceryLeft(both)).toBe(7)
    const paid = spendSorcery(both, 6)!
    expect([used(paid), used(paid, 'feat:metamagic-adept')]).toEqual([5, 1])
  })
})
