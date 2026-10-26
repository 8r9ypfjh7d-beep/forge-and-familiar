import { describe, expect, it } from 'vitest'
import { sheetLayout, type SheetMode } from './mode'

const all = (mode: SheetMode, dying = false) => {
  const l = sheetLayout(mode, { dying })
  return [...l.top, ...l.columns[0], ...l.columns[1], ...(l.vitals ?? []), ...Object.values(l.tabs ?? {}).flat()]
}

describe('sheet modes', () => {
  it('story mode: HP, rests and who you are in one top card, then abilities, skills, notes and story spells', () => {
    const l = sheetLayout('story', { dying: false })
    expect(l.top).toEqual(['identity', 'abilities'])
    expect(l.vitals).toEqual(['hp', 'rests'])
    expect(l.columns).toEqual([['skills'], ['notes', 'storySpells', 'slots', 'attacks', 'inventory']])
    for (const s of ['turn', 'reactions', 'quickcast', 'resources', 'supplies', 'history', 'spells'] as const) expect(all('story')).not.toContain(s)
  })

  it('combat mode is the Roll20 page: summary with HP, skills rail, tabs', () => {
    const l = sheetLayout('combat', { dying: false })
    expect(l.top).toEqual(['summary'])
    expect(l.columns).toEqual([['skills'], ['tabs']])
    expect(l.vitals).toEqual(['hp', 'rests'])
    expect(Object.keys(l.tabs ?? {})).toEqual(['combat', 'spells', 'inventory', 'features', 'notes'])
    expect(l.tabs?.combat[0]).toBe('fight')
    for (const s of ['turn', 'reactions', 'storySpells', 'resources'] as const) expect(all('combat')).not.toContain(s)
  })

  it('death saves show only at 0 HP, first in both modes', () => {
    expect(all('story')).not.toContain('death')
    expect(all('combat')).not.toContain('death')
    expect(sheetLayout('story', { dying: true }).top[0]).toBe('death')
    expect(sheetLayout('combat', { dying: true }).top[0]).toBe('death')
  })

  it('never shows a section twice, and both modes keep HP, rests, slots, skills and notes', () => {
    for (const mode of ['story', 'combat'] as const) {
      for (const dying of [false, true]) {
        const s = all(mode, dying)
        expect(new Set(s).size).toBe(s.length)
        for (const need of ['hp', 'rests', 'slots', 'skills', 'notes'] as const) expect(s).toContain(need)
      }
    }
  })
})
