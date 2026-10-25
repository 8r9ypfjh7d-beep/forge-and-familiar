import { describe, expect, it } from 'vitest'
import { sheetLayout, type SheetMode } from './mode'

const all = (mode: SheetMode, dying = false) => {
  const l = sheetLayout(mode, { dying })
  return [...l.top, ...l.columns[0], ...l.columns[1]]
}

describe('sheet modes', () => {
  it('story mode leads with roleplay sections and hides turn tools', () => {
    const l = sheetLayout('story', { dying: false })
    expect(l.columns[0]).toEqual(['identity', 'hp', 'social', 'notes'])
    expect(all('story')).not.toContain('turn')
    expect(all('story')).not.toContain('reactions')
    expect(all('story')).not.toContain('quickcast')
  })

  it('combat mode leads with HP and the turn, and drops story sections', () => {
    const l = sheetLayout('combat', { dying: false })
    expect(l.top).toEqual(['quickcast'])
    expect(l.columns[0].slice(0, 2)).toEqual(['hp', 'turn'])
    for (const s of ['identity', 'social', 'notes'] as const) expect(all('combat')).not.toContain(s)
  })

  it('death saves show only at 0 HP, first in both modes', () => {
    expect(all('story')).not.toContain('death')
    expect(all('combat')).not.toContain('death')
    expect(sheetLayout('story', { dying: true }).columns[0].slice(0, 2)).toEqual(['hp', 'death'])
    expect(sheetLayout('combat', { dying: true }).columns[0].slice(0, 2)).toEqual(['hp', 'death'])
  })

  it('never shows a section twice, and both modes keep HP, rests, stats and history', () => {
    for (const mode of ['story', 'combat'] as const) {
      for (const dying of [false, true]) {
        const s = all(mode, dying)
        expect(new Set(s).size).toBe(s.length)
        for (const need of ['hp', 'rests', 'stats', 'attacks', 'slots', 'resources', 'history'] as const) expect(s).toContain(need)
      }
    }
  })
})
