import { describe, expect, it } from 'vitest'
import { loadKind, type Spell } from '../content'
import { derive } from '../rules'
import { longRest, shortRest, takeDamage } from '../sheet/engine'
import { endEffect, endFight, endsWithFight, setEffectOn, spendOnceEffects, startEffect } from '../sheet/effects'
import { makeCharacter } from '../sheet/fixtures'
import { castPlan, castSpell, castWarnings, defaultSlot } from './cast'
import { effectToggles } from '../sheet/combat/combat'

const warlock = () => makeCharacter({
  classes: [{ classId: 'warlock', level: 3 }],
  baseAbilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
  rulesEdition: '2024',
  spells: [{ id: 'armor-of-agathys', classId: 'warlock' }, { id: 'hex', classId: 'warlock' }],
})
const byId = async (id: string, edition: '2014' | '2024' = '2024'): Promise<Spell> =>
  (await loadKind('spells', { sources: edition === '2024' ? ['srd-5.2', 'books-2024'] : ['srd-5.1', 'books-2014'] })).find(s => s.id === id)!

describe('casting from the sheet', () => {
  it('Armor of Agathys spends a pact slot, gives temp HP by its level and shows under Effects', async () => {
    const c = warlock()
    const aoa = await byId('armor-of-agathys')
    const slot = defaultSlot(c, aoa)
    expect(slot).toMatchObject({ source: 'pact', level: 2 })
    const plan = castPlan(c, derive(c), aoa, slot)
    const { character } = castSpell(c, plan, { slot, tempHp: 10 })
    expect(character.state.pactSlotsUsed).toBe(1)
    expect(character.state.tempHp).toBe(10)
    expect(character.state.effects).toMatchObject([{ id: 'spell:armor-of-agathys', level: 2, on: true, reflect: { damage: '10', type: 'cold' } }])
    // It ends once the temporary hit points are gone.
    expect(takeDamage(character, 4).state.effects).toHaveLength(1)
    expect(takeDamage(character, 12).state.effects).toEqual([])
  })

  it('the Effects switch for Armor of Agathys reads the pact slot level before it is cast', async () => {
    const c = makeCharacter({ ...warlock(), classes: [{ classId: 'warlock', level: 5 }] })
    const aoa = await byId('armor-of-agathys')
    const sw = effectToggles(c, derive(c), [aoa]).find(e => e.id === 'spell:armor-of-agathys')!
    expect(sw).toMatchObject({ spell: { id: 'armor-of-agathys' }, slot: { source: 'pact', level: 3 }, start: { level: 3, reflect: { damage: '15' } } })
    expect(castPlan(c, derive(c), aoa, sw.slot).tempHp).toBe('15')
  })

  it('warns before a cast with no slot left or one that ends concentration', async () => {
    const c = warlock()
    const hex = await byId('hex')
    expect(castWarnings(c, hex)).toEqual({ noSlot: false })
    const spent = { ...c, state: { ...c.state, pactSlotsUsed: 2 } }
    expect(castWarnings(spent, hex)).toEqual({ noSlot: true })
    expect(castWarnings(spent, hex, undefined, true)).toEqual({ noSlot: false })
    const holding = startEffect(c, castPlan(c, derive(c), await byId('bless')).effect!).character
    expect(castWarnings(holding, hex)).toEqual({ noSlot: false, ends: 'Bless' })
    // Recasting the same spell isn't a second concentration.
    const hexed = startEffect(c, castPlan(c, derive(c), hex).effect!).character
    expect(castWarnings(hexed, hex).ends).toBeUndefined()
  })

  it('a new concentration spell ends the old one', async () => {
    const c = warlock()
    const hex = castSpell(c, castPlan(c, derive(c), await byId('hex'))).character
    const bless = await byId('bless')
    const { character, ended } = startEffect(hex, castPlan(hex, derive(hex), bless).effect!)
    expect(ended).toEqual(['Hex'])
    expect(character.state.effects?.map(e => e.id)).toEqual(['spell:bless'])
  })

  it('rests end what they outlast; switches and End work', async () => {
    const c = warlock()
    let x = castSpell(c, castPlan(c, derive(c), await byId('hex'))).character
    x = castSpell(x, castPlan(x, derive(x), await byId('mage-armor'))).character
    expect(shortRest(x).state.effects?.map(e => e.id)).toEqual(['spell:mage-armor'])
    expect(longRest(x).state.effects).toEqual([])
    expect(setEffectOn(x, 'spell:hex', false).state.effects?.find(e => e.id === 'spell:hex')?.on).toBe(false)
    expect(endEffect(x, 'spell:hex').state.effects?.map(e => e.id)).toEqual(['spell:mage-armor'])
  })

  it('a 2014 smite is spent by the hit', async () => {
    const c = makeCharacter({ classes: [{ classId: 'paladin', level: 5 }] })
    const smite = await byId('searing-smite', '2014')
    const x = castSpell(c, castPlan(c, derive(c), smite)).character
    expect(x.state.effects?.[0]).toMatchObject({ once: true, damage: '1d6' })
    expect(spendOnceEffects(x).state.effects).toEqual([])
  })

  it('Aid raises max HP and heals the same', async () => {
    const c = makeCharacter({ classes: [{ classId: 'cleric', level: 3 }] })
    const hurt = { ...c, state: { ...c.state, currentHp: 5 } }
    const max = derive(c).maxHp
    const aid = await byId('aid')
    const slot = defaultSlot(hurt, aid)
    const { character } = castSpell(hurt, castPlan(hurt, derive(hurt), aid, slot), { slot, heal: 5 })
    expect(derive(character).maxHp).toBe(max + 5)
    expect(character.state.currentHp).toBe(10)
  })
})

describe('how long effects last', () => {
  it('instantaneous spells leave nothing running, Self spells are always on me', async () => {
    const c = warlock()
    expect(castPlan(c, derive(c), await byId('false-life')).effect).toBeUndefined()
    expect(castPlan(c, derive(c), await byId('false-life')).tempHp).toBeDefined()
    expect(castPlan(c, derive(c), await byId('false-life', '2014')).effect).toMatchObject({ whileTempHp: true, self: true })
    expect(castPlan(c, derive(c), await byId('armor-of-agathys')).effect?.self).toBe(true)
    expect(castPlan(c, derive(c), await byId('hex')).effect?.self).toBeUndefined()
  })

  it('End of fight ends round and minute effects, and keeps the hour-long ones', async () => {
    let c = warlock()
    for (const id of ['shield', 'armor-of-agathys']) c = startEffect(c, castPlan(c, derive(c), await byId(id)).effect!).character
    c = startEffect(c, castPlan(c, derive(c), await byId('bless')).effect!).character
    const stale = { ...c, state: { ...c.state, effects: [...c.state.effects!, { id: 'spell:old', name: 'Old', from: 'spell' as const, on: true, duration: 'Instantaneous' }] } }
    expect(endFight(stale).state.effects?.map(e => e.id)).toEqual(['spell:armor-of-agathys'])
    expect(endsWithFight({ duration: 'Up to 10 minutes' })).toBe(false)
    expect(endFight(endFight(stale))).toEqual(endFight(stale))
  })
})
