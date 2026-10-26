import { describe, expect, it } from 'vitest'
import { loadKind } from '../content'
import { sourceFor, spellAccess } from '../spellbook/access'
import { byLevel, pickableSpells } from './picker'

const scores = { str: 10, dex: 12, con: 14, int: 8, wis: 10, cha: 18 }

async function setup(classes: { classId: string; level: number; subclassId?: string }[]) {
  const sources = [sourceFor('2014')]
  const [spells, cls, subs] = await Promise.all([loadKind('spells', { sources }), loadKind('classes', { sources }), loadKind('subclasses', { sources })])
  return { spells, access: spellAccess({ classes }, cls, subs, scores) }
}

describe('pin form spell list', () => {
  it("offers a warlock's own list up to the levels it can cast", async () => {
    const { spells, access } = await setup([{ classId: 'warlock', level: 7 }])
    const own = pickableSpells(spells, access, false)
    expect(own.map(s => s.id)).toEqual(expect.arrayContaining(['eldritch-blast', 'hellish-rebuke', 'banishment']))
    expect(own.some(s => s.id === 'fireball' || s.level > 4)).toBe(false)
    expect(pickableSpells(spells, access, true)).toHaveLength(spells.length)
  })

  it('adds subclass spells', async () => {
    const { spells, access } = await setup([{ classId: 'warlock', level: 7, subclassId: 'fiend' }])
    expect(pickableSpells(spells, access, false).map(s => s.id)).toContain('fireball')
  })

  it('offers every spell when the character has no spell list, and searches by name', async () => {
    const { spells, access } = await setup([{ classId: 'fighter', level: 3 }])
    expect(pickableSpells(spells, access, false)).toHaveLength(spells.length)
    expect(pickableSpells(spells, access, false, 'FIRE').map(s => s.name)).toEqual(expect.arrayContaining(['Fire Bolt', 'Fireball']))
  })

  it('groups by level, cantrips first', async () => {
    const { spells, access } = await setup([{ classId: 'wizard', level: 5 }])
    expect(byLevel(pickableSpells(spells, access, false)).map(([l]) => l)).toEqual([0, 1, 2, 3])
  })
})
