import { describe, expect, it } from 'vitest'
import { derive } from '../rules'
import { makeCharacter } from '../sheet/fixtures'
import { boonLeft, canPassInspiration, dropSpareInspiration, passInspiration, removeBoon, spendInspiration, spendBoon } from '../sheet/boons'
import { longRest } from '../sheet/engine'
import { takeGifts } from './gifts'
import { applyStash, getStash, parseStashLog, type StashAction } from './stash'
import type { Party } from './types'

const party: Party = {
  id: 'p1', name: 'Garden Gang', code: 'GARDEN', dmId: 'dm',
  members: [
    { userId: 'dm', joinedAt: '2026-01-01T00:00:00Z' },
    { userId: 'roy', characterId: 'vex', joinedAt: '2026-01-01T00:00:00Z' },
    { userId: 'tamir', characterId: 'pip', joinedAt: '2026-01-01T00:00:00Z' },
  ],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}
const roy = { userId: 'roy', characterId: 'vex' }
const tamir = { userId: 'tamir', characterId: 'pip' }
const vex = (extra = {}) => makeCharacter({ id: 'vex', ownerId: 'roy', ...extra })

function gift(p: Party, by: string, action: Omit<Extract<StashAction, { type: 'gift' }>, 'type' | 'names'>) {
  const res = applyStash(p, by, { type: 'gift', names: ['Vex'], ...action })
  if (!res.ok) throw new Error(res.reason)
  return res.party
}

describe('Inspiration from the DM', () => {
  it('lands once on the character it was given to, and the log reads back', () => {
    const p = gift(party, 'dm', { inspiration: true, to: [roy], byName: 'Noa' })
    expect(getStash(p).log[0].text).toBe('gave Inspiration to Vex')
    expect(parseStashLog(getStash(p).log[0].text)).toEqual({ kind: 'inspiration', who: 'Vex', passed: false })
    const once = takeGifts(vex(), [p])
    expect(once.state.inspiration).toBe(true)
    expect(takeGifts(once, [p])).toBe(once)
    // Tamir's character gets nothing.
    expect(takeGifts(makeCharacter({ id: 'pip', ownerId: 'tamir' }), [p]).state.inspiration).toBeFalsy()
  })

  it('2014: one at a time, and the holder may pass it on', () => {
    const held = vex({ state: { ...vex().state, inspiration: true } })
    const p = gift(party, 'dm', { inspiration: true, to: [roy] })
    const again = takeGifts(held, [p])
    expect(again.state.inspiration).toBe(true)
    expect(again.state.spareInspiration).toBeFalsy()
    expect(canPassInspiration(again)).toBe(true)
    expect(passInspiration(again).state.inspiration).toBe(false)
  })

  it('2024: a second Heroic Inspiration waits as a spare to pass on, and only the spare can be passed', () => {
    const held = vex({ rulesEdition: '2024', state: { ...vex().state, inspiration: true } })
    expect(canPassInspiration(held)).toBe(false)
    const again = takeGifts(held, [gift(party, 'dm', { inspiration: true, to: [roy] })])
    expect(again.state.spareInspiration).toBe(true)
    const passed = passInspiration(again)
    expect(passed.state).toMatchObject({ inspiration: true, spareInspiration: false })
    expect(dropSpareInspiration(again).state.spareInspiration).toBe(false)
    expect(spendInspiration(passed).state.inspiration).toBe(false)
  })

  it('a player may only pass Inspiration, and never to themselves', () => {
    expect(applyStash(party, 'roy', { type: 'gift', inspiration: true, to: [roy], names: [] }).ok).toBe(false)
    expect(applyStash(party, 'roy', { type: 'gift', boon: { kind: 'charm', name: 'Luck' }, to: [tamir], names: [] }).ok).toBe(false)
    const res = applyStash(party, 'roy', { type: 'gift', inspiration: true, to: [tamir], names: ['Pip'] })
    if (!res.ok) throw new Error(res.reason)
    expect(getStash(res.party).log[0].text).toBe('passed Inspiration to Pip')
  })

  it('2024 Humans gain Heroic Inspiration on a long rest; 2014 Humans do not', () => {
    expect(longRest(vex({ rulesEdition: '2024', raceId: 'human' })).state.inspiration).toBe(true)
    expect(longRest(vex({ raceId: 'human' })).state.inspiration).toBeFalsy()
  })
})

describe('Rewards from the DM', () => {
  it('a charm lands with its uses, rolls heal, and is gone when spent', () => {
    const p = gift(party, 'dm', { boon: { kind: 'charm', name: ' Potion-luck ', uses: 2, roll: { kind: 'heal', dice: '2d4+2' } }, to: [roy], byName: 'Noa' })
    expect(parseStashLog(getStash(p).log[0].text)).toEqual({ kind: 'reward', name: 'Potion-luck', who: 'Vex' })
    const c = takeGifts(vex({ state: { ...vex().state, currentHp: 1 } }), [p])
    const [b] = c.state.boons!
    expect(b).toMatchObject({ name: 'Potion-luck', from: 'Noa', uses: 2, used: 0 })
    const once = spendBoon(c, b.id, 6)
    expect(once.state.currentHp).toBe(7)
    expect(boonLeft(once.state.boons![0])).toBe(1)
    expect(spendBoon(once, b.id, 0).state.boons).toEqual([])
  })

  it('temporary hit points never stack', () => {
    const p = gift(party, 'dm', { boon: { kind: 'charm', name: 'Stout heart', roll: { kind: 'tempHp', value: 10 } }, to: [roy] })
    const c = takeGifts(vex({ state: { ...vex().state, tempHp: 12 } }), [p])
    expect(spendBoon(c, c.state.boons![0].id).state.tempHp).toBe(12)
  })

  it("a blessing's stat changes count while kept", () => {
    const p = gift(party, 'dm', { boon: { kind: 'blessing', name: 'Ward', stats: [{ kind: 'ac', value: 1 }] }, to: [roy] })
    const before = derive(vex()).armorClass.value
    const c = takeGifts(vex(), [p])
    expect(derive(c).armorClass.value).toBe(before + 1)
    expect(spendBoon(c, c.state.boons![0].id).state.boons).toHaveLength(1)
    expect(derive(removeBoon(c, c.state.boons![0].id)).armorClass.value).toBe(before)
  })

  it('needs a name', () => {
    expect(applyStash(party, 'dm', { type: 'gift', boon: { kind: 'charm', name: '  ' }, to: [roy], names: [] }).ok).toBe(false)
  })
})
