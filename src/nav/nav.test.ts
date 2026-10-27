import { describe, expect, it } from 'vitest'
import { navItems, navKeyFor } from './items'

const keys = (items: { key: string }[]) => items.map(i => i.key)

describe('navItems', () => {
  it('gives a player Ask the DM but no DM screen', () => {
    const { main, more } = navItems({ isDm: false, dmAccount: false })
    expect(keys(main)).toEqual(['list', 'party', 'combat', 'requests'])
    expect(keys(more)).toContain('rules')
  })

  it('gives the DM account the DM screen instead of Ask the DM', () => {
    expect(keys(navItems({ isDm: true, dmAccount: true }).main)).toEqual(['list', 'party', 'combat', 'dm'])
  })

  it('gives a player who leads a party both', () => {
    expect(keys(navItems({ isDm: true, dmAccount: false }).main)).toEqual(['list', 'party', 'combat', 'dm', 'requests'])
  })

  it('never lists a screen twice', () => {
    const { main, more } = navItems({ isDm: true, dmAccount: false })
    const all = keys([...main, ...more])
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('navKeyFor', () => {
  it('maps top-level screens to their own tab', () => {
    expect(navKeyFor('party')).toBe('party')
    expect(navKeyFor('rules')).toBe('rules')
  })

  it('keeps character screens under Characters', () => {
    for (const kind of ['sheet', 'build', 'edit', 'levels', 'journal', 'print', 'table', 'starters']) expect(navKeyFor(kind)).toBe('list')
  })
})
