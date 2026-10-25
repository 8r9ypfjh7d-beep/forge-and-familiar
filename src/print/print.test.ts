import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { buildPrintSheet } from './sheetData'

const played = () => {
  const c = makeCharacter({ inventory: [{ uid: 'a', itemId: 'longsword', qty: 1, equipped: true }] })
  return { ...c, state: { ...c.state, currentHp: 12, tempHp: 4, spellSlotsUsed: [1, 0, 0, 0, 0, 0, 0, 0, 0], conditions: ['poisoned' as const] } }
}

describe('buildPrintSheet', () => {
  it('fills header, abilities, saves and skills from the engine', () => {
    const s = buildPrintSheet(makeCharacter(), { withPlayState: false })
    expect(s.classLine).toBe('Fighter 5 / Wizard 2')
    expect(s.level).toBe(7)
    expect(s.proficiencyBonus).toBe('+3')
    expect(s.abilities).toHaveLength(6)
    expect(s.saves.find(x => x.name === 'Strength')).toEqual({ name: 'Strength', bonus: '+6', proficient: true })
    expect(s.skills).toHaveLength(18)
  })

  it('lists equipped weapons as attacks and shows inventory', () => {
    const s = buildPrintSheet(played(), { withPlayState: false })
    expect(s.attacks.map(a => a.name)).toContain('Longsword')
    expect(s.equipment).toEqual([{ name: 'Longsword', qty: 1, equipped: true }])
  })

  it('leaves play state blank for pencil play', () => {
    const s = buildPrintSheet(played(), { withPlayState: false })
    expect(s.currentHp).toBeUndefined()
    expect(s.tempHp).toBeUndefined()
    expect(s.spellSlots[0]).toMatchObject({ label: '1st', used: 0 })
    expect(s.conditions).toEqual([])
  })

  it('fills play state when asked', () => {
    const s = buildPrintSheet(played(), { withPlayState: true })
    expect(s.currentHp).toBe(12)
    expect(s.tempHp).toBe(4)
    expect(s.spellSlots[0].used).toBe(1)
    expect(s.conditions).toEqual(['Poisoned'])
  })

  it('includes class resources and custom trackers', () => {
    const c = makeCharacter()
    const s = buildPrintSheet(
      { ...c, state: { ...c.state, counters: [{ id: 'k', label: 'Arrows', max: 20, used: 3, recharge: 'none' }] } },
      { withPlayState: true },
    )
    expect(s.resources.map(r => r.label)).toContain('Arrows')
    expect(s.resources.find(r => r.label === 'Arrows')).toMatchObject({ max: 20, used: 3, note: undefined })
  })
})
