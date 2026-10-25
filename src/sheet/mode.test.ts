import { describe, expect, it } from 'vitest'
import { sheetLayout, type SheetMode } from './mode'

const all = (mode: SheetMode, dying = false) => {
  const l = sheetLayout(mode, { dying })
  return [...l.top, ...l.columns[0], ...l.columns[1], ...(l.vitals ?? []), ...Object.values(l.tabs ?? {}).flat()]
}

describe('sheet modes', () => {
  it('story mode leads with roleplay sections and hides turn tools', () => {
    const l = sheetLayout('story', { dying: false })
    expect(l.columns[0]).toEqual(['identity', 'hp', 'social', 'notes'])
    expect(all('story')).not.toContain('turn')
    expect(all('story')).not.toContain('reactions')
    expect(all('story')).not.toContain('quickcast')
  })

  it('combat mode is the Roll20 page: summary with HP, skills rail, tabs', () => {
    const l = sheetLayout('combat', { dying: false })
    expect(l.top).toEqual(['summary'])
    expect(l.columns).toEqual([['skills'], ['tabs']])
    expect(l.vitals).toEqual(['hp', 'rests'])
    expect(Object.keys(l.tabs ?? {})).toEqual(['combat', 'spells', 'inventory', 'features', 'notes'])
    expect(l.tabs?.combat[0]).toBe('fight')
    for (const s of ['turn', 'reactions', 'clock', 'social'] as const) expect(all('combat')).not.toContain(s)
  })

  it('death saves show only at 0 HP, first in both modes', () => {
    expect(all('story')).not.toContain('death')
    expect(all('combat')).not.toContain('death')
    expect(sheetLayout('story', { dying: true }).columns[0].slice(0, 2)).toEqual(['hp', 'death'])
    expect(sheetLayout('combat', { dying: true }).top[0]).toBe('death')
  })

  it('never shows a section twice, and both modes keep HP, rests, stats and history', () => {
    for (const mode of ['story', 'combat'] as const) {
      for (const dying of [false, true]) {
        const s = all(mode, dying)
        expect(new Set(s).size).toBe(s.length)
        for (const need of ['hp', 'rests', 'slots', 'resources', 'history'] as const) expect(s).toContain(need)
      }
    }
  })
})
