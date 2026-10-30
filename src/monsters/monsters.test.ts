/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { makeBlock } from '../npc/fixtures'
import { actionUses, conSave, crLabel, initBonus, limitedActions, passivePerception, sensesText, speedText, typeLine, usageText } from '.'

const css = readFileSync(new URL('./monsters.css', import.meta.url), 'utf8')

describe('stat block text', () => {
  it('labels fractions and speeds', () => {
    expect(crLabel(0.125)).toBe('1/8')
    expect(crLabel(0.5)).toBe('1/2')
    expect(crLabel(10)).toBe('10')
    expect(speedText({ walk: '30 ft.', fly: '60 ft.', hover: true })).toBe('30 ft., fly 60 ft.')
    expect(typeLine(makeBlock())).toBe('Medium humanoid (any race), any non-lawful alignment')
    expect(sensesText(makeBlock())).toEqual(['passive perception 10'])
  })

  it('writes usage notes the way the books do', () => {
    const b = makeBlock()
    expect(usageText(b.actions[0])).toBe('')
    expect(usageText(b.actions[1])).toBe(' (Recharge 5–6)')
    expect(usageText(b.actions[2])).toBe(' (3/Day)')
    expect(usageText(b.actions[3])).toBe(' (Recharges after a Short or Long Rest)')
  })
})

describe('stat block reads', () => {
  it('derives initiative, CON save and passive Perception', () => {
    const b = makeBlock()
    expect(initBonus(b)).toBe(3)
    expect(initBonus(makeBlock({ initiative: 7 }))).toBe(7)
    expect(conSave(b)).toBe(2)
    expect(conSave(makeBlock({ savingThrows: { con: 6 } }))).toBe(6)
    expect(passivePerception(b)).toBe(10)
    expect(passivePerception(makeBlock({ senses: {}, skills: { perception: 5 } }))).toBe(15)
  })

  it('lists limited actions with their uses', () => {
    const names = limitedActions(makeBlock()).map(a => a.name)
    expect(names).toEqual(['Fire Breath', 'Rally', 'Second Wind'])
    expect(limitedActions(makeBlock()).map(actionUses)).toEqual([1, 3, 1])
    expect(actionUses(makeBlock().actions[0])).toBeNull()
  })
})

describe('stat block styles', () => {
  it('use logical properties only, so RTL needs no overrides', () => {
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/)
  })

  it('take surfaces from glass tokens, not hard-coded whites', () => {
    expect(css).not.toMatch(/#fff\b|rgba?\(\s*255/i)
  })
})
