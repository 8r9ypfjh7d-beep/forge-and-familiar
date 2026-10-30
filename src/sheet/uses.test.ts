import { describe, expect, it } from 'vitest'
import { derive, getResources, itemSpellCast, planUse, potionEffect, potionHealing, resourceClassLevel, spellLimit } from '../rules'
import { castSpell } from '../spellbook/cast'
import { longRest } from './engine'
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

  it('reads spell limits from notes', () => {
    expect(spellLimit('at will')).toBeUndefined()
    expect(spellLimit('once per long rest')).toEqual({ max: 1, recharge: 'long' })
    expect(spellLimit('3/day')).toEqual({ max: 3, recharge: 'long' })
    expect(spellLimit('once per short or long rest')).toEqual({ max: 1, recharge: 'short' })
    expect(spellLimit('regains at dawn, twice')).toEqual({ max: 2, recharge: 'dawn' })
    expect(spellLimit('2 charges')).toEqual({ charges: 2 })
  })

  it('a tiefling\'s Hellish Rebuke is once per long rest: a use, spent by casting, back after a long rest', () => {
    const c = makeCharacter({ raceId: 'tiefling', classes: [{ classId: 'warlock', level: 3 }] })
    const rebuke = derive(c).itemSpells.find(s => s.spell.startsWith('Hellish Rebuke'))!
    expect(rebuke.useId).toBeDefined()
    expect(getResources(c).find(r => r.id === rebuke.useId)).toMatchObject({ max: 1, recharge: 'long' })
    const cast = castSpell(c, {}, { spend: { id: rebuke.useId!, n: 1 } }).character
    expect(cast.state.resources[rebuke.useId!].used).toBe(1)
    expect(longRest(cast).state.resources[rebuke.useId!].used).toBe(0)
  })

  it('Lay on Hands spends any amount from the pool', () => {
    const c = makeCharacter({ classes: [{ classId: 'paladin', level: 4 }] })
    const plan = planUse('lay-on-hands', 'Lay on Hands', { edition: '2014', classLevel: 4 })
    expect(plan.pool).toBe('heal')
    const hurt = { ...c, state: { ...c.state, currentHp: 10 } }
    const healed = spendResource(hurt, 'lay-on-hands', plan, { heal: 7 }, 7)
    expect(healed.state.resources['lay-on-hands'].used).toBe(7)
    expect(healed.state.currentHp).toBe(17)
  })

  it('a potion with stat effects runs them after drinking', () => {
    const c = makeCharacter({ inventory: [{ uid: 'g', itemId: 'x', name: 'Potion of Hill Giant Strength', qty: 1, equipped: false, effects: [{ kind: 'abilitySet', ability: 'str', value: 21 }] }] })
    const fx = potionEffect('g', 'Potion of Hill Giant Strength', c.inventory[0].effects)
    const drunk = drinkPotion(c, 'g', 0, fx)
    expect(drunk.inventory).toEqual([])
    expect(derive(drunk).abilities.str).toBe(21)
  })

  it('2014 paladins get a Divine Smite switch that spends a slot', () => {
    const c = makeCharacter({ classes: [{ classId: 'paladin', level: 5 }], inventory: [{ uid: 'l', itemId: 'longsword', qty: 1, equipped: true }] })
    const smite = effectToggles(c, derive(c)).find(e => e.id === 'feature:divine-smite')
    expect(smite).toMatchObject({ damage: '2d8', damageType: 'radiant', slot: { level: 1 } })
  })
})
