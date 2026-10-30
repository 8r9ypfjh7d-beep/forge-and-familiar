import { describe, expect, it } from 'vitest'
import { loadKind, type Edition } from '../content'
import type { Character } from '../model/character'
import { canTake, isSecret, spellAccess, sourceFor, wizardSpellbook } from './access'
import { canPickExtra, extraKey, extraList, extraSources, grantedSpells, keepValidSpells } from './extra'

const spellsOf = (edition: Edition) => loadKind('spells', { sources: [sourceFor(edition)] })

type Input = Parameters<typeof extraSources>[0]
const make = (c: Partial<Input>): Input => ({ raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'fighter', level: 1 }], ...c })

describe('race spells', () => {
  it('reads 2024 lineage spells and their levels from the traits', async () => {
    const drow = grantedSpells(make({ rulesEdition: '2024', raceId: 'elf', subraceId: 'drow', classes: [{ classId: 'rogue', level: 3 }] }), await spellsOf('2024'))
    expect(drow.map(g => [g.spell.id, g.atLevel, g.unlocked])).toEqual([['dancing-lights', 1, true], ['faerie-fire', 3, true], ['darkness', 5, false]])
  })

  it('looks up the 2014 Tiefling Infernal Legacy table', async () => {
    const t = grantedSpells(make({ raceId: 'tiefling' }), await spellsOf('2014'))
    expect(t.map(g => [g.spell.id, g.atLevel, g.from])).toEqual([['thaumaturgy', 1, 'Infernal Legacy'], ['hellish-rebuke', 3, 'Infernal Legacy'], ['darkness', 5, 'Infernal Legacy']])
  })

  it('gives races without magic nothing', async () => {
    expect(grantedSpells(make({ raceId: 'dwarf', subraceId: 'hill-dwarf' }), await spellsOf('2014'))).toEqual([])
  })
})

describe('extra spell picks', () => {
  it('gives a 2014 High Elf one wizard cantrip', async () => {
    const [src] = extraSources(make({ raceId: 'elf', subraceId: 'high-elf' }))
    expect(src).toMatchObject({ slot: 'race', cantrips: 1, spells: 0, fixedList: 'wizard' })
    const spells = await spellsOf('2014')
    const pool = spells.filter(s => canPickExtra(s, src, extraList(src)))
    expect(pool.length).toBeGreaterThan(5)
    expect(pool.every(s => s.level === 0 && s.classes.includes('wizard'))).toBe(true)
  })

  it('takes Magic Initiate from a 2024 background with its fixed list', () => {
    const [src] = extraSources(make({ rulesEdition: '2024', backgroundId: 'acolyte' }))
    expect(src).toMatchObject({ slot: 'bg', grantId: 'magic-initiate', cantrips: 2, spells: 1, fixedList: 'cleric' })
  })

  it('lets a Human pick the list for an origin Magic Initiate', () => {
    const c = make({ rulesEdition: '2024', backgroundId: 'soldier', originFeatId: 'magic-initiate' })
    const [src] = extraSources(c)
    expect(src.fixedList).toBeUndefined()
    expect(extraList(src)).toBe('cleric')
    expect(extraList(src, [{ id: 'guidance', classId: extraKey(src, 'druid') }])).toBe('druid')
  })

  it('limits leveled picks to 1st level', async () => {
    const [src] = extraSources(make({ rulesEdition: '2024', backgroundId: 'sage' }))
    const spells = await spellsOf('2024')
    const ok = spells.filter(s => canPickExtra(s, src, 'wizard'))
    expect(ok.some(s => s.id === 'magic-missile')).toBe(true)
    expect(ok.some(s => s.level > 1)).toBe(false)
  })

  it('drops picks for classes and sources the character no longer has', () => {
    const c: Input = make({
      raceId: 'elf', subraceId: 'wood-elf', classes: [{ classId: 'wizard', level: 1 }],
      spells: [{ id: 'fire-bolt', classId: 'wizard' }, { id: 'sacred-flame', classId: 'cleric' }, { id: 'light', classId: 'extra:race:wizard' }],
    })
    expect(keepValidSpells(c)).toEqual([{ id: 'fire-bolt', classId: 'wizard' }])
  })
})

describe('wizard spellbook', () => {
  it('holds six spells at 1st level and two more each level', async () => {
    expect(wizardSpellbook(1)).toBe(6)
    expect(wizardSpellbook(5)).toBe(14)
    const sources = [sourceFor('2014')]
    const [classes, subclasses] = await Promise.all([loadKind('classes', { sources }), loadKind('subclasses', { sources })])
    const scores = { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 }
    const [a] = spellAccess({ classes: [{ classId: 'wizard', level: 3 }] } as Pick<Character, 'classes'>, classes, subclasses, scores)
    expect(a).toMatchObject({ spellbook: 10, limit: 6, kind: 'prepared' })
  })
})

describe('Magical Secrets', () => {
  const load = async (edition: Edition) => {
    const sources = [sourceFor(edition)]
    const [spells, classes, subclasses] = await Promise.all([loadKind('spells', { sources }), loadKind('classes', { sources }), loadKind('subclasses', { sources })])
    return { spells, classes, subclasses }
  }
  const scores = { str: 8, dex: 14, con: 12, int: 10, wis: 12, cha: 18 }

  it('lets a 2014 bard 10 take two spells from any list', async () => {
    const l = await load('2014')
    const [a] = spellAccess({ classes: [{ classId: 'bard', level: 10 }] }, l.classes, l.subclasses, scores)
    expect(a.secrets).toEqual({ count: 2 })
    const fireball = l.spells.find(s => s.id === 'fireball')!
    expect(canTake(fireball, a)).toBe(true)
    expect(isSecret(fireball, a)).toBe(true)
    const [low] = spellAccess({ classes: [{ classId: 'bard', level: 9 }] }, l.classes, l.subclasses, scores)
    expect(canTake(fireball, low)).toBe(false)
    const [lore] = spellAccess({ classes: [{ classId: 'bard', level: 6, subclassId: 'lore' }] }, l.classes, l.subclasses, scores)
    expect(lore.secrets).toEqual({ count: 2 })
  })

  it('adds the cleric, druid and wizard lists for a 2024 bard 10', async () => {
    const l = await load('2024')
    const [a] = spellAccess({ classes: [{ classId: 'bard', level: 10 }], rulesEdition: '2024' }, l.classes, l.subclasses, scores)
    expect(a.secrets).toEqual({ lists: ['cleric', 'druid', 'wizard'] })
    expect(canTake(l.spells.find(s => s.id === 'fireball')!, a)).toBe(true)
  })
})
