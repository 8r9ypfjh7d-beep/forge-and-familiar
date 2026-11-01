import { describe, expect, it } from 'vitest'
import { sheetLayout, type SheetMode } from './mode'

const all = (mode: SheetMode, dying = false, narrow = false) => {
  const l = sheetLayout(mode, { dying, narrow })
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

  it('story mode: notes, effects, rewards, attacks and inventory beside the shared widgets', () => {
    expect(sheetLayout('story', { dying: false }).columns).toEqual([['spellCard', 'skills'], ['notes', 'effects', 'boons', 'attacks', 'inventory']])
    for (const s of ['resources', 'supplies', 'history', 'spells'] as const) expect(all('story')).not.toContain(s)
  })

  it('combat mode: Roll20-style tabs beside the skills, spells only in the Spells tab', () => {
    const l = sheetLayout('combat', { dying: false })
    expect(l.columns).toEqual([['skills'], ['tabs']])
    expect(Object.keys(l.tabs ?? {})).toEqual(['combat', 'spells', 'inventory', 'features', 'notes'])
    expect(l.tabs?.checks).toBeUndefined()
    expect(l.tabs?.combat?.[0]).toBe('fight')
    expect(l.tabs?.spells).toEqual(['spells', 'metamagic'])
    expect(all('combat')).not.toContain('spellCard')
  })

  it('combat mode tracks feature uses once, in the Features & Traits tab', () => {
    const tabs = sheetLayout('combat', { dying: false }).tabs
    expect(tabs?.features).toEqual(['resources', 'features'])
    expect(all('combat').filter(s => s === 'resources')).toHaveLength(1)
  })

  it('combat on a phone: abilities and skills move into a Checks tab, so the tabs follow HP', () => {
    const l = sheetLayout('combat', { dying: false, narrow: true })
    expect(l.top).toEqual(['summary'])
    expect(l.columns).toEqual([[], ['tabs']])
    expect(Object.keys(l.tabs ?? {})).toEqual(['combat', 'checks', 'spells', 'inventory', 'features', 'notes'])
    expect(l.tabs?.checks).toEqual(['abilities', 'skills'])
    expect(sheetLayout('combat', { dying: true, narrow: true, powerUp: true }).top).toEqual(['death', 'summary', 'powerUp'])
    // Story mode keeps its layout on phones.
    expect(sheetLayout('story', { dying: false, narrow: true })).toEqual(sheetLayout('story', { dying: false }))
  })

  it('a live combat adds a Map tab right after Combat, on desktop and phones, and only in combat mode', () => {
    expect(Object.keys(sheetLayout('combat', { dying: false, liveMap: true }).tabs ?? {})).toEqual(['combat', 'map', 'spells', 'inventory', 'features', 'notes'])
    expect(Object.keys(sheetLayout('combat', { dying: false, narrow: true, liveMap: true }).tabs ?? {})).toEqual(['combat', 'map', 'checks', 'spells', 'inventory', 'features', 'notes'])
    expect(sheetLayout('combat', { dying: false, liveMap: true }).tabs?.map).toEqual(['map'])
    expect(all('combat')).not.toContain('map')
    expect(sheetLayout('story', { dying: false, liveMap: true })).toEqual(sheetLayout('story', { dying: false }))
  })

  it('death saves show only at 0 HP, first in both modes', () => {
    expect(all('story')).not.toContain('death')
    expect(all('combat')).not.toContain('death')
    expect(sheetLayout('story', { dying: true }).top[0]).toBe('death')
    expect(sheetLayout('combat', { dying: true }).top[0]).toBe('death')
  })

  it('never shows a section twice, and both modes keep HP, rests, spells, skills and notes', () => {
    for (const mode of ['story', 'combat'] as const) {
      for (const [dying, narrow] of [[false, false], [true, false], [false, true], [true, true]]) {
        const s = all(mode, dying, narrow)
        expect(new Set(s).size).toBe(s.length)
        for (const need of ['hp', 'rests', mode === 'story' ? 'spellCard' : 'spells', 'skills', 'notes'] as const) expect(s).toContain(need)
      }
    }
  })
})
