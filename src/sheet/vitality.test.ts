import { describe, expect, it } from 'vitest'
import { makeCharacter } from './fixtures'
import { ringFraction, vitalityRings } from './vitality'

describe('vitality rings', () => {
  it('counts hit points, spell slots and hit dice', () => {
    // Fighter 5 / Wizard 2: three 1st-level slots, 7 hit dice.
    const c = makeCharacter()
    const used = { ...c, state: { ...c.state, currentHp: 20, spellSlotsUsed: [1], hitDiceSpent: { d10: 2 } } }
    const [hp, slots, dice] = vitalityRings(used)
    expect(hp).toMatchObject({ kind: 'hp', value: 20 })
    expect(slots).toEqual({ kind: 'slots', value: 2, max: 3 })
    expect(dice).toEqual({ kind: 'hitDice', value: 5, max: 7 })
  })

  it('adds pact slots and leaves slots out for a non-caster', () => {
    const lock = makeCharacter({ classes: [{ classId: 'warlock', level: 7 }] })
    expect(vitalityRings({ ...lock, state: { ...lock.state, pactSlotsUsed: 1 } })[1]).toEqual({ kind: 'slots', value: 1, max: 2 })
    const fighter = makeCharacter({ classes: [{ classId: 'fighter', level: 3 }] })
    expect(vitalityRings(fighter).map(r => r.kind)).toEqual(['hp', 'hitDice'])
  })

  it('keeps fractions between 0 and 1', () => {
    expect(ringFraction({ kind: 'hp', value: 0, max: 0 })).toBe(0)
    expect(ringFraction({ kind: 'hp', value: 60, max: 45 })).toBe(1)
  })
})
