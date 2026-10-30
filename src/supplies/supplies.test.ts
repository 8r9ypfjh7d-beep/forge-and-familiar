import { describe, expect, it } from 'vitest'
import { longRest } from '../sheet/engine'
import { makeCharacter } from '../sheet/fixtures'
import { derive } from '../rules'
import { ammoForAttack, ammoSpent, countOf, daysWithoutFood, defaultMeal, endDay, foodLimit, rangedWeapons, rationsLeft, recoverAmmo, spendAmmo } from './supplies'

const archer = makeCharacter({
  inventory: [
    { uid: 'bow', itemId: 'longbow', qty: 1, equipped: true },
    { uid: 'xbow', itemId: 'light-crossbow', qty: 1, equipped: true },
    { uid: 'sword', itemId: 'longsword', qty: 1, equipped: true },
    { uid: 'a1', itemId: 'arrows', qty: 20, equipped: false },
    { uid: 'a2', itemId: 'arrows', qty: 3, equipped: false },
    { uid: 'r', itemId: 'rations', qty: 2, equipped: false },
  ],
})

const fireTimes = (n: number) => Array.from({ length: n }).reduce<typeof archer>(c => spendAmmo(c, 'arrows'), archer)
const day = (c: typeof archer, meal: Parameters<typeof endDay>[2]) => endDay(c, longRest(c), meal)

describe('ammunition', () => {
  it('finds the ammo an attack row fires, and none for a sword', () => {
    const attacks = derive(archer).attacks
    expect(ammoForAttack(archer, attacks.find(a => a.name === 'Longbow')!)?.ammoId).toBe('arrows')
    expect(ammoForAttack(archer, attacks.find(a => a.name === 'Light Crossbow')!)?.ammoId).toBe('bolts')
    expect(ammoForAttack(archer, attacks.find(a => a.name === 'Longsword')!)).toBeUndefined()
  })

  it('lists equipped ammunition weapons with their stack counts', () => {
    expect(rangedWeapons(archer).map(r => [r.weapon.id, r.ammoId, r.left])).toEqual([
      ['longbow', 'arrows', 23],
      ['light-crossbow', 'bolts', 0],
    ])
  })

  it('each shot takes one piece and is remembered for recovery', () => {
    const c = fireTimes(5)
    expect(countOf(c, 'arrows')).toBe(18)
    expect(ammoSpent(c, 'arrows')).toBe(5)
  })

  it('cannot fire with an empty quiver', () => {
    expect(spendAmmo(archer, 'bolts')).toBe(archer)
    const empty = fireTimes(23)
    expect(countOf(empty, 'arrows')).toBe(0)
    expect(spendAmmo(empty, 'arrows')).toBe(empty)
    expect(empty.inventory.filter(e => e.itemId === 'arrows')).toHaveLength(2)
  })

  it('searching the battlefield recovers half, rounded down', () => {
    const c = recoverAmmo(fireTimes(5))
    expect(countOf(c, 'arrows')).toBe(20)
    expect(ammoSpent(c, 'arrows')).toBe(0)
    expect(recoverAmmo(c)).toBe(c)
  })

  it('recovery recreates a stack that was removed', () => {
    const fired = spendAmmo(spendAmmo(archer, 'arrows'), 'arrows')
    const dropped = { ...fired, inventory: fired.inventory.filter(e => e.itemId !== 'arrows') }
    expect(countOf(recoverAmmo(dropped), 'arrows')).toBe(1)
  })

  it('unrecovered ammunition is lost after a long rest', () => {
    expect(ammoSpent(day(fireTimes(4), 'ration'), 'arrows')).toBe(0)
  })
})

describe('rations', () => {
  it('a long rest with a ration eats one', () => {
    const c = day(archer, 'ration')
    expect(countOf(c, 'rations')).toBe(1)
    expect(daysWithoutFood(c)).toBe(0)
  })

  it('choosing a ration with none left counts as hungry', () => {
    const c = day(day(day(archer, 'ration'), 'ration'), 'ration')
    expect(countOf(c, 'rations')).toBe(0)
    expect(daysWithoutFood(c)).toBe(1)
  })

  it('other food keeps the rations and resets hunger', () => {
    const c = day(day(archer, 'none'), 'other')
    expect(countOf(c, 'rations')).toBe(2)
    expect(daysWithoutFood(c)).toBe(0)
  })

  it('counts hungry days past 3 + CON and resets on a meal', () => {
    const limit = foodLimit(archer)
    expect(limit).toBe(5)
    let c = archer
    for (let i = 0; i <= limit; i++) c = day(c, 'none')
    expect(daysWithoutFood(c)).toBe(limit + 1)
    c = day(c, 'ration')
    expect(daysWithoutFood(c)).toBe(0)
  })

  it('does nothing when the long rest itself was refused', () => {
    const dying = { ...archer, state: { ...archer.state, currentHp: 0 } }
    expect(endDay(dying, longRest(dying), 'ration')).toBe(dying)
  })
})

describe('rations in equipment packs', () => {
  const packed = makeCharacter({ inventory: [{ uid: 'p', itemId: 'explorers-pack', qty: 1, equipped: false }] })

  it('counts the pack\'s 10 days, so a fresh hero is not out of food', () => {
    expect(rationsLeft(packed)).toBe(10)
    expect(defaultMeal(packed)).toBe('ration')
  })

  it('eats loose rations first, then from the pack, then goes hungry', () => {
    const both = { ...packed, inventory: [...packed.inventory, { uid: 'r', itemId: 'rations', qty: 1, equipped: false }] }
    let c = day(both, 'ration')
    expect(countOf(c, 'rations')).toBe(0)
    expect(rationsLeft(c)).toBe(10)
    for (let i = 0; i < 10; i++) c = day(c, 'ration')
    expect(rationsLeft(c)).toBe(0)
    expect(daysWithoutFood(c)).toBe(0)
    c = day(c, 'ration')
    expect(daysWithoutFood(c)).toBe(1)
  })

  it('a 2024 Priest\'s Pack holds 7 days', () => {
    const priest = makeCharacter({ rulesEdition: '2024', inventory: [{ uid: 'p', itemId: 'priests-pack', qty: 1, equipped: false }] })
    expect(rationsLeft(priest)).toBe(7)
  })
})
