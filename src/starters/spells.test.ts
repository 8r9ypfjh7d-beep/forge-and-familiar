import { describe, expect, it } from 'vitest'
import { STARTER_HEROES, createStarter, starterById } from './heroes'
import { withStarterSpells } from './spells'

describe('starter spells', () => {
  it('gives the ready-made wizard cantrips and a spellbook, a few left unprepared', async () => {
    const c = await withStarterSpells(createStarter(starterById('elara')!, 'u', 'P'))
    const ids = c.spells!.map(s => s.id)
    expect(ids).toEqual(expect.arrayContaining(['fire-bolt', 'magic-missile', 'shield']))
    expect(c.spells!.some(s => s.prepared === false)).toBe(true)
  })
  it('gives every caster spells and leaves the others alone', async () => {
    for (const h of STARTER_HEROES) {
      const c = await withStarterSpells(createStarter(h, 'u', 'P'))
      expect({ id: h.id, has: (c.spells?.length ?? 0) > 0 }).toEqual({ id: h.id, has: !!h.spells })
    }
  })
})
