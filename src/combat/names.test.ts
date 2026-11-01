import { describe, expect, it } from 'vitest'
import { rowName, shownVars } from './names'

const monster = { source: 'srd-2014', id: 'goblin' }

describe('combatant names in the reader language', () => {
  it('translates library monster rows and keeps their number', () => {
    expect(rowName({ name: 'Goblin 2', monster }, 'Goblin', 'גובלין')).toBe('גובלין 2')
    expect(rowName({ name: 'Goblin', monster }, 'Goblin', 'גובלין')).toBe('גובלין')
  })
  it('keeps renamed rows, NPC sheets and characters as typed', () => {
    expect(rowName({ name: 'Snaggletooth', monster }, 'Goblin', 'גובלין')).toBe('Snaggletooth')
    expect(rowName({ name: 'Goblin 2', monster, npcId: 'n1' }, 'Goblin', 'גובלין')).toBe('Goblin 2')
    expect(rowName({ name: 'Goblin 2' }, 'Goblin', 'גובלין')).toBe('Goblin 2')
  })
  it('swaps names in log variables', () => {
    const shown = new Map([['Goblin 1', 'גובלין 1'], ['Goblin 2', 'גובלין 2']])
    expect(shownVars({ name: 'Goblin 1', amount: 3 }, shown)).toEqual({ name: 'גובלין 1', amount: 3 })
    expect(shownVars({ effect: 'Bless', targets: 'Goblin 2, Mira' }, shown)).toEqual({ effect: 'Bless', targets: 'גובלין 2, Mira' })
  })
})
