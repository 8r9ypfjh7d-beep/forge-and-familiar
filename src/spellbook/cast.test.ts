import { describe, expect, it } from 'vitest'
import { loadKind, type Spell } from '../content'
import { derive } from '../rules'
import { longRest, shortRest, takeDamage } from '../sheet/engine'
import { endEffect, setEffectOn, spendOnceEffects, startEffect } from '../sheet/effects'
import { makeCharacter } from '../sheet/fixtures'
import { castPlan, castSpell, defaultSlot } from './cast'

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
