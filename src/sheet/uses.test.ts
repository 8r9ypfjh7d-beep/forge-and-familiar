import { describe, expect, it } from 'vitest'
import { derive, itemSpellCast, planUse, potionHealing, resourceClassLevel } from '../rules'
import { effectToggles } from './combat/combat'
import { makeCharacter } from './fixtures'
import { drinkPotion, spendResource } from './uses'

describe('using features and items', () => {
  it('Second Wind heals 1d10 + fighter level and spends its use', () => {
    const c = makeCharacter()
    expect(resourceClassLevel(c, 'second-wind')).toBe(5)
    const plan = planUse('second-wind', 'Second Wind', { edition: '2014', classLevel: 5 })
    expect(plan).toEqual({ heal: '1d10+5' })
    const hurt = { ...c, state: { ...c.state, currentHp: 10 } }
    const used = spendResource(hurt, 'second-wind', plan, { heal: 8 })
    expect(used.state.resources['second-wind'].used).toBe(1)
    expect(used.state.currentHp).toBe(18)
  })

  it('Rage starts a running effect: resistances, and its damage switch turns on', () => {
    const c = makeCharacter({ classes: [{ classId: 'barbarian', level: 3 }], inventory: [{ uid: 'a', itemId: 'greataxe', qty: 1, equipped: true }] })
    const plan = planUse('rage', 'Rage', { edition: '2014', classLevel: 3 })
    const raging = spendResource(c, 'rage', plan)
    expect(raging.state.resources.rage.used).toBe(1)
    expect(derive(raging).defenses.resistances).toEqual(expect.arrayContaining(['bludgeoning', 'piercing', 'slashing']))
    const rage = effectToggles(raging, derive(raging)).find(e => e.id === 'rage')
    expect(rage?.live?.on).toBe(true)
    expect(effectToggles(raging, derive(raging)).filter(e => e.live?.id === 'feature:rage')).toHaveLength(1)
  })

  it('features without numbers still spend a use', () => {
    const c = makeCharacter()
    expect(planUse('action-surge', 'Action Surge', { edition: '2014', classLevel: 5 })).toEqual({})
    expect(spendResource(c, 'action-surge', {}).state.resources['action-surge'].used).toBe(1)
  })

  it('drinks a healing potion: one fewer, healed', () => {
    expect(potionHealing('potion-of-healing-greater')).toBe('4d4+4')
    expect(potionHealing('custom', 'Potion of Healing')).toBe('2d4+2')
    expect(potionHealing('rope')).toBeUndefined()
    const c = makeCharacter({ inventory: [{ uid: 'p', itemId: 'potion-healing', qty: 2, equipped: false }] })
    const hurt = { ...c, state: { ...c.state, currentHp: 5 } }
    const after = drinkPotion(hurt, 'p', 7)
    expect(after.inventory[0].qty).toBe(1)
    expect(after.state.currentHp).toBe(12)
  })

  it('reads the level an item or race spell is cast at', () => {
    expect(itemSpellCast('Hellish Rebuke (as 2nd level)')).toEqual({ name: 'Hellish Rebuke', level: 2 })
    expect(itemSpellCast('Fireball')).toEqual({ name: 'Fireball' })
  })
})
