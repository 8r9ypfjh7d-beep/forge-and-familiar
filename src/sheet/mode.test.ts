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
      expect(l.columns[0].at(-1)).toBe('skills')
    }
  })

  it('story mode: notes, attacks and inventory beside the shared widgets', () => {
    expect(sheetLayout('story', { dying: false }).columns).toEqual([['spellCard', 'skills'], ['notes', 'attacks', 'inventory']])
    for (const s of ['resources', 'supplies', 'history', 'spells'] as const) expect(all('story')).not.toContain(s)
  })

  it('combat mode: Roll20-style tabs beside the skills, spells only in the Spells tab', () => {
    const l = sheetLayout('combat', { dying: false })
    expect(l.columns).toEqual([['skills'], ['tabs']])
    expect(Object.keys(l.tabs ?? {})).toEqual(['combat', 'spells', 'inventory', 'features', 'notes'])
    expect(l.tabs?.combat[0]).toBe('fight')
    expect(l.tabs?.spells).toEqual(['spells', 'metamagic'])
    expect(all('combat')).not.toContain('spellCard')
  })

  it('combat mode tracks feature uses once, in the Features & Traits tab', () => {
    const tabs = sheetLayout('combat', { dying: false }).tabs
    expect(tabs?.features).toEqual(['resources', 'features'])
    expect(all('combat').filter(s => s === 'resources')).toHaveLength(1)
  })

  it('death saves show only at 0 HP, first in both modes', () => {
    expect(all('story')).not.toContain('death')
    expect(all('combat')).not.toContain('death')
    expect(sheetLayout('story', { dying: true }).top[0]).toBe('death')
    expect(sheetLayout('combat', { dying: true }).top[0]).toBe('death')
  })

  it('never shows a section twice, and both modes keep HP, rests, spells, skills and notes', () => {
    for (const mode of ['story', 'combat'] as const) {
      for (const dying of [false, true]) {
        const s = all(mode, dying)
        expect(new Set(s).size).toBe(s.length)
        for (const need of ['hp', 'rests', mode === 'story' ? 'spellCard' : 'spells', 'skills', 'notes'] as const) expect(s).toContain(need)
      }
    }
  })
})
