import { describe, expect, it } from 'vitest'
import { canOpen, navItems, navKeyFor } from './items'

const keys = (items: { key: string }[]) => items.map(i => i.key)

describe('navItems', () => {
  it('gives a player Ask the DM but no DM screen or combat tracker', () => {
    const { main, more } = navItems({ isDm: false, partyDm: false })
    expect(keys(main)).toEqual(['campaigns', 'list', 'party', 'requests'])
    expect(keys(more)).toContain('rules')
    expect(keys(more)).not.toContain('admin')
  })

  it('gives the DM of the party in play just the DM pages and Party', () => {
    expect(keys(navItems({ isDm: true, partyDm: true }).main)).toEqual(['campaigns', 'dm', 'combat', 'party'])
  })

  it('gives the admin DM tabs when they run the party in play, still with Admin under More', () => {
    const { main, more } = navItems({ isDm: true, partyDm: true, admin: true })
    expect(keys(main)).toEqual(['campaigns', 'dm', 'combat', 'party'])
    expect(keys(more)[0]).toBe('admin')
  })

  it('gives the admin account a player\'s tabs, with the admin page first under More', () => {
    const { main, more } = navItems({ isDm: true, partyDm: false, admin: true })
    expect(keys(main)).toEqual(['campaigns', 'list', 'party', 'requests'])
    expect(keys(more)[0]).toBe('admin')
  })

  it('never lists a screen twice', () => {
    for (const ctx of [{ isDm: false, partyDm: false }, { isDm: true, partyDm: true }, { isDm: true, partyDm: false, admin: true }]) {
      const { main, more } = navItems(ctx)
      const all = keys([...main, ...more])
      expect(new Set(all).size).toBe(all.length)
    }
  })
})

describe('canOpen', () => {
  const player = { isDm: false, partyDm: false }
  it('blocks the DM pages and the admin page for a player', () => {
    for (const kind of ['dm', 'combat', 'admin']) expect(canOpen(kind, player)).toBe(false)
    for (const kind of ['list', 'party', 'requests', 'sheet', 'rules']) expect(canOpen(kind, player)).toBe(true)
  })

  it('opens the DM pages for the DM and the admin, the admin page only for the admin', () => {
    const dm = { isDm: true, partyDm: true }
    const admin = { isDm: true, partyDm: false, admin: true }
    expect(canOpen('combat', dm) && canOpen('dm', dm)).toBe(true)
    expect(canOpen('admin', dm)).toBe(false)
    for (const kind of ['dm', 'combat', 'admin']) expect(canOpen(kind, admin)).toBe(true)
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
