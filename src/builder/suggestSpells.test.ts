import { describe, expect, it } from 'vitest'
import { loadKind } from '../content'
import { getAbilityScores } from '../rules'
import { randomDraft } from '../random'
import { spellAccess } from '../spellbook/access'
import { suggestedSpells } from './suggestSpells'

/** Every spell, class and subclass the builder offers, books included. */
async function library(edition: '2014' | '2024') {
  const [spells, classes, subclasses] = await Promise.all([loadKind('spells', { edition }), loadKind('classes', { edition }), loadKind('subclasses', { edition })])
  const first = <T extends { id: string }>(l: T[]) => l.filter((x, i) => l.findIndex(y => y.id === x.id) === i)
  return { spells: first(spells), classes: first(classes), subclasses }
}

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

describe('suggestedSpells', () => {
  for (const edition of ['2014', '2024'] as const) {
    it(`fills every caster's picks without duplicates (${edition})`, async () => {
      const lib = await library(edition)
      const byId = new Map(lib.spells.map(s => [s.id, s]))
      for (let seed = 1; seed <= 60; seed++) {
        const d = { ...randomDraft('p1', edition, seeded(seed)), spells: [] }
        const spells = suggestedSpells(d, lib)
        expect(spells.length).toBe(new Set(spells.map(k => `${k.classId}|${k.id}`)).size)
        for (const a of spellAccess(d, lib.classes, lib.subclasses, getAbilityScores(d), undefined, lib.spells)) {
          const mine = spells.filter(k => k.classId === a.classId).map(k => byId.get(k.id)!)
          const cantrips = mine.filter(s => s.level === 0)
          expect({ seed, classId: a.classId, cantrips: cantrips.length }).toEqual({ seed, classId: a.classId, cantrips: a.cantrips })
          if (a.maxLevel > 0) expect({ seed, classId: a.classId, leveled: mine.length - cantrips.length }).toEqual({ seed, classId: a.classId, leveled: a.spellbook ?? a.limit })
        }
      }
    })
  }

  it('keeps the player\'s picks and suggests well-known spells for a new wizard', async () => {
    const lib = await library('2014')
    const base = randomDraft('p1', '2014', seeded(3))
    const d = { ...base, classes: [{ classId: 'wizard', level: 1 }], spells: [{ id: 'light', classId: 'wizard' }] }
    const ids = suggestedSpells(d, lib).map(k => k.id)
    expect(ids).toContain('light')
    expect(ids).toContain('fire-bolt')
    expect(ids).toContain('magic-missile')
    expect(ids).toContain('shield')
    expect(ids.filter(id => byLevel(lib, id) === 0)).toHaveLength(3)
    expect(ids.filter(id => byLevel(lib, id) > 0)).toHaveLength(6)
    // A level 1 wizard with INT 16 prepares 4; the other 2 sit in the book.
    const book = suggestedSpells(d, lib).filter(k => byLevel(lib, k.id) > 0)
    expect(book.filter(k => k.prepared === false).length).toBe(6 - (spellAccess(d, lib.classes, lib.subclasses, getAbilityScores(d), undefined, lib.spells)[0].limit))
  })
})

function byLevel(lib: { spells: { id: string; level: number }[] }, id: string) {
  return lib.spells.find(s => s.id === id)?.level ?? -1
}
