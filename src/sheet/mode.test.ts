import { describe, expect, it } from 'vitest'
import { sheetLayout, type SheetMode } from './mode'

const all = (mode: SheetMode, dying = false) => {
  const l = sheetLayout(mode, { dying })
  return [...l.top, ...l.columns[0], ...l.columns[1], ...(l.vitals ?? []), ...Object.values(l.tabs ?? {}).flat()]
}

describe('sheet modes', () => {
  it('both modes show the same widgets in the same places', () => {
    const story = sheetLayout('story', { dying: false })
    const combat = sheetLayout('combat', { dying: false })
    for (const l of [story, combat]) {
      expect(l.top).toEqual(['summary', 'abilities'])
      expect(l.vitals).toEqual(['hp', 'rests'])
      expect(l.columns[0]).toEqual(['spellCard', 'skills'])
    }
  })

  it('story mode: notes, attacks and inventory beside the shared widgets', () => {
    expect(sheetLayout('story', { dying: false }).columns[1]).toEqual(['notes', 'attacks', 'inventory'])
    for (const s of ['quickcast', 'resources', 'supplies', 'history', 'spells'] as const) expect(all('story')).not.toContain(s)
  })

  it('combat mode: Roll20-style tabs beside the shared widgets, spell slots on the page', () => {
    const l = sheetLayout('combat', { dying: false })
    expect(l.columns[1]).toEqual(['tabs'])
    expect(Object.keys(l.tabs ?? {})).toEqual(['combat', 'spells', 'inventory', 'features', 'notes'])
    expect(l.tabs?.combat[0]).toBe('fight')
    expect([...l.top, ...l.columns[0]]).toContain('spellCard')
    expect(all('combat')).not.toContain('resources')
  })

  it('death saves show only at 0 HP, first in both modes', () => {
    expect(all('story')).not.toContain('death')
    expect(all('combat')).not.toContain('death')
    expect(sheetLayout('story', { dying: true }).top[0]).toBe('death')
    expect(sheetLayout('combat', { dying: true }).top[0]).toBe('death')
  })

  it('never shows a section twice, and both modes keep HP, rests, the Spells card, skills and notes', () => {
    for (const mode of ['story', 'combat'] as const) {
      for (const dying of [false, true]) {
        const s = all(mode, dying)
        expect(new Set(s).size).toBe(s.length)
        for (const need of ['hp', 'rests', 'spellCard', 'skills', 'notes'] as const) expect(s).toContain(need)
      }
    }
  })
})
