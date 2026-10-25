import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { setSlotUsed } from '../sheet/engine'
import { SPELL_PRESETS } from './presets'
import { addEntry, entriesOf, moveEntry, removeEntry, resourceUse, slotChoices, spellDamage, spendResource, spendSlot } from './quickcast'
import type { SpellEntry } from './types'

// Fighter 5 / Wizard 2: caster level 2, so three 1st-level slots and nothing higher.
const brannoc = makeCharacter()
const warlock = makeCharacter({ classes: [{ classId: 'warlock', level: 5 }] })
const spell = (name: string): SpellEntry => ({ id: name, kind: 'spell', ...SPELL_PRESETS.find(p => p.name === name)! })

describe('pinned entries', () => {
  it('adds, reorders and removes', () => {
    let c = addEntry(brannoc, { id: 'a', kind: 'attack', name: 'Unarmed Strike' })
    c = addEntry(c, { id: 'b', kind: 'resource', resourceId: 'second-wind' })
    expect(entriesOf(moveEntry(c, 'b', -1)).map(e => e.id)).toEqual(['b', 'a'])
    expect(moveEntry(c, 'a', -1)).toBe(c)
    expect(entriesOf(removeEntry(c, 'a')).map(e => e.id)).toEqual(['b'])
  })

  it('treats old saves without the field as empty', () => {
    expect(entriesOf(brannoc)).toEqual([])
  })
})

describe('slots', () => {
  it('offers the lowest slots that can cast the spell', () => {
    expect(slotChoices(brannoc, 1)).toEqual([{ source: 'slot', level: 1, remaining: 3 }])
    expect(slotChoices(brannoc, 2)).toEqual([])
    expect(slotChoices(brannoc, 0)).toEqual([])
  })

  it('spends a slot and runs out', () => {
    const c = spendSlot(brannoc, slotChoices(brannoc, 1)[0])
    expect(c.state.spellSlotsUsed[0]).toBe(1)
    expect(slotChoices(setSlotUsed(c, 1, 3), 1)).toEqual([])
  })

  it('uses warlock pact slots, which are always cast at pact level', () => {
    const [pact] = slotChoices(warlock, 1)
    expect(pact).toEqual({ source: 'pact', level: 3, remaining: 2 })
    expect(spendSlot(warlock, pact).state.pactSlotsUsed).toBe(1)
  })
})

describe('spell damage', () => {
  it('adds dice per level above the base', () => {
    expect(spellDamage(spell('Fireball'), 3, 5)).toBe('8d6')
    expect(spellDamage(spell('Fireball'), 5, 9)).toBe('8d6+2d6')
  })

  it('scales flat bonuses in the upcast too (Magic Missile)', () => {
    expect(spellDamage(spell('Magic Missile'), 3, 5)).toBe('3d4+3+2d4+2')
  })

  it('scales cantrips by character level', () => {
    expect(spellDamage(spell('Fire Bolt'), 0, 4)).toBe('1d10')
    expect(spellDamage(spell('Fire Bolt'), 0, 5)).toBe('2d10')
    expect(spellDamage(spell('Fire Bolt'), 0, 17)).toBe('4d10')
  })

  it('adds the spellcasting modifier when asked', () => {
    expect(spellDamage(spell('Cure Wounds'), 2, 3, 3)).toBe('1d8+1d8+3')
    expect(spellDamage(spell('Cure Wounds'), 1, 3, -1)).toBe('1d8-1')
  })

  it('has nothing to roll for spells without damage', () => {
    expect(spellDamage(spell('Shield'), 1, 5)).toBeUndefined()
  })
})

describe('resources', () => {
  it('spends class resources', () => {
    expect(resourceUse(brannoc, 'action-surge')).toEqual({ label: 'Action Surge', max: 1, remaining: 1 })
    expect(resourceUse(spendResource(brannoc, 'action-surge'), 'action-surge')?.remaining).toBe(0)
  })

  it('spends player trackers and stops at zero', () => {
    const c = makeCharacter({ state: { ...brannoc.state, counters: [{ id: 'arrows', label: 'Arrows', max: 1, used: 0, recharge: 'none' }] } })
    const once = spendResource(c, 'arrows')
    expect(resourceUse(once, 'arrows')?.remaining).toBe(0)
    expect(spendResource(once, 'arrows')).toBe(once)
  })
})
