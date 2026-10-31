import { describe, expect, it } from 'vitest'
import { canOpen, navItems, navKeyFor } from './items'
import { hashToView, viewToHash, type View } from './route'

const keys = (items: { key: string }[]) => items.map(i => i.key)

describe('navItems', () => {
  it('gives a player Ask the DM but no DM screen or combat tracker', () => {
    const { main, more } = navItems({ isDm: false, partyDm: false })
    expect(keys(main)).toEqual(['campaigns', 'list', 'party', 'requests'])
    expect(keys(more)).toContain('rules')
    expect(keys(more)).not.toContain('admin')
  })

  it('keeps Characters for the DM of the party in play, with the initiative tracker under More', () => {
    const { main, more } = navItems({ isDm: true, partyDm: true })
    expect(keys(main)).toEqual(['campaigns', 'list', 'dm', 'party'])
    expect(keys(more)[0]).toBe('combat')
  })

  it('gives the admin DM tabs when they run the party in play, still with Admin under More', () => {
    const { main, more } = navItems({ isDm: true, partyDm: true, admin: true })
    expect(keys(main)).toEqual(['campaigns', 'list', 'dm', 'party'])
    expect(keys(more)[0]).toBe('admin')
    expect(keys(more)).toContain('combat')
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
    for (const kind of ['dm', 'combat', 'admin', 'watch', 'npc']) expect(canOpen(kind, player)).toBe(false)
    for (const kind of ['list', 'party', 'requests', 'sheet', 'rules']) expect(canOpen(kind, player)).toBe(true)
  })

  it('opens the DM pages for the DM and the admin, the admin page only for the admin', () => {
    const dm = { isDm: true, partyDm: true }
    const admin = { isDm: true, partyDm: false, admin: true }
    expect(canOpen('combat', dm) && canOpen('dm', dm) && canOpen('watch', dm) && canOpen('npc', dm)).toBe(true)
    expect(canOpen('admin', dm)).toBe(false)
    for (const kind of ['dm', 'combat', 'admin', 'npc']) expect(canOpen(kind, admin)).toBe(true)
  })
})

describe('navKeyFor', () => {
  it('maps top-level screens to their own tab', () => {
    expect(navKeyFor('party')).toBe('party')
    expect(navKeyFor('rules')).toBe('rules')
  })

  it('lights the DM screen for an NPC sheet', () => {
    expect(navKeyFor('npc')).toBe('dm')
  })

  it('keeps character screens under Characters', () => {
    for (const kind of ['sheet', 'build', 'edit', 'levels', 'journal', 'print', 'table', 'starters']) expect(navKeyFor(kind)).toBe('list')
  })
})

describe('hash routes', () => {
  const views: View[] = [
    { kind: 'campaigns' }, { kind: 'list' }, { kind: 'build' }, { kind: 'starters' }, { kind: 'sheet', id: 'abc-123' },
    { kind: 'edit', id: 'x' }, { kind: 'levelup', id: 'x' }, { kind: 'levels', id: 'x' }, { kind: 'plan', id: 'x' }, { kind: 'print', id: 'x' }, { kind: 'watch', id: 'x' },
    { kind: 'combat' }, { kind: 'combat', encounterId: 'e1' }, { kind: 'dm' }, { kind: 'dm', tab: 'requests' }, { kind: 'dm', tab: 'rolls' }, { kind: 'dm', tab: 'npcs' }, { kind: 'requests' },
    { kind: 'party' }, { kind: 'party', partyId: 'p1' }, { kind: 'party', startWith: 'join' }, { kind: 'party', startWith: 'start' },
    { kind: 'rules' }, { kind: 'homebrew' }, { kind: 'admin' }, { kind: 'npc', id: 'npc-goblin-boss' },
  ]
  it('round-trips every screen through the address bar', () => {
    for (const v of views) expect(hashToView(viewToHash(v))).toEqual(v)
  })

  it('reads readable links and falls back to Home for anything unknown', () => {
    expect(viewToHash({ kind: 'sheet', id: 'abc' })).toBe('#/sheet/abc')
    expect(viewToHash({ kind: 'list' })).toBe('#/heroes')
    expect(hashToView('')).toEqual({ kind: 'campaigns' })
    expect(hashToView('#/nope')).toEqual({ kind: 'campaigns' })
    expect(hashToView('#/sheet')).toEqual({ kind: 'list' })
    expect(viewToHash({ kind: 'npc', id: 'n1' })).toBe('#/npc/n1')
    expect(hashToView('#/npc/new')).toEqual({ kind: 'npc', id: 'new' })
    expect(hashToView('#/dm/npcs')).toEqual({ kind: 'dm', tab: 'npcs' })
    expect(hashToView('#/npc')).toEqual({ kind: 'dm' })
    expect(hashToView('#/sheet/%E0%A4%A')).toEqual({ kind: 'campaigns' })
  })
})
