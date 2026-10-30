import { describe, expect, it } from 'vitest'
import { concentrationDc, damageAfterDefenses, damageDefense, derive, meleeReprisals } from '../rules'
import { getRollMode } from '../rules/rollMode'
import { concentration, startEffect } from './effects'
import { setCondition, takeDamage } from './engine'
import { makeCharacter } from './fixtures'

const defenses = (resistances: string[], immunities: string[] = []) => ({ defenses: { resistances, immunities, conditionImmunities: [] } })

describe('damage types', () => {
  it('halves resisted damage, rounding down, and zeroes immune damage', () => {
    expect(damageAfterDefenses(9, damageDefense(defenses(['fire']), 'fire'))).toBe(4)
    expect(damageAfterDefenses(9, damageDefense(defenses([], ['poison']), 'poison'))).toBe(0)
    expect(damageAfterDefenses(9, damageDefense(defenses(['fire']), 'cold'))).toBe(9)
    expect(damageDefense(defenses(['fire']), undefined)).toBeUndefined()
  })

  it('reads free-text defense lines word by word', () => {
    expect(damageDefense(defenses(['bludgeoning, piercing and slashing']), 'piercing')).toBe('resistant')
    expect(damageDefense(defenses(['firearms']), 'fire')).toBeUndefined()
  })

  it('counts a tiefling’s fire resistance from the race', () => {
    const c = makeCharacter({ raceId: 'tiefling' })
    expect(damageDefense(derive(c), 'fire', c)).toBe('resistant')
  })

  it('makes a petrified character resist everything', () => {
    const c = setCondition(makeCharacter(), 'petrified', true)
    expect(damageDefense(derive(c), 'slashing', c)).toBe('resistant')
  })
})

describe('concentration after damage', () => {
  it('sets the DC at 10 or half the damage, capped at 30 in 2024', () => {
    expect(concentrationDc(8)).toBe(10)
    expect(concentrationDc(31)).toBe(15)
    expect(concentrationDc(100)).toBe(50)
    expect(concentrationDc(100, '2024')).toBe(30)
  })

  const hexed = () => startEffect(makeCharacter(), { id: 'spell:hex', name: 'Hex', from: 'spell', concentration: true }).character

  it('keeps concentration while above 0 HP and ends it at 0', () => {
    const c = hexed()
    expect(concentration(takeDamage(c, 3))?.name).toBe('Hex')
    expect(concentration(takeDamage(c, c.state.currentHp))).toBeUndefined()
  })

  it('ends concentration when the character becomes incapacitated', () => {
    expect(concentration(setCondition(hexed(), 'stunned', true))).toBeUndefined()
    expect(concentration(setCondition(hexed(), 'poisoned', true))?.name).toBe('Hex')
  })
})

describe('reprisals', () => {
  it('lists Armor of Agathys while it runs', () => {
    const c = startEffect(makeCharacter(), { id: 'spell:armor-of-agathys', name: 'Armor of Agathys', from: 'spell', reflect: { damage: '10', type: 'cold' } }).character
    expect(meleeReprisals(c)).toEqual([{ id: 'spell:armor-of-agathys', name: 'Armor of Agathys', damage: '10', type: 'cold' }])
    expect(meleeReprisals(makeCharacter())).toEqual([])
  })
})

describe('player conditions', () => {
  it('adds and removes a condition once, and rolls pick it up', () => {
    const poisoned = setCondition(setCondition(makeCharacter(), 'poisoned', true), 'poisoned', true)
    expect(poisoned.state.conditions).toEqual(['poisoned'])
    expect(getRollMode(poisoned, 'attack')).toBe('disadvantage')
    expect(setCondition(poisoned, 'poisoned', false).state.conditions).toEqual([])
  })
})
