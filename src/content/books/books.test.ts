import { describe, expect, it } from 'vitest'
import { BOOK_SOURCES, BOOK_TITLES, loadKind, sanitizePack, type Edition, type Spell } from '..'
import { subclassesFor } from '../../rules/data/subclasses'
import { spellIdByName, spellSourcesFor } from '../../spellbook/access'

const EDITIONS: Edition[] = ['2014', '2024']
const SCHOOLS = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation']
const CLASSES = ['artificer', 'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']
const book = (edition: Edition) => loadKind('spells', { sources: [`books-${edition}`] })
const srd = (edition: Edition) => loadKind('spells', { sources: [edition === '2024' ? 'srd-5.2' : 'srd-5.1'] })
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

describe('book spells', () => {
  it.each(EDITIONS)('%s entries are complete, with both summaries', async edition => {
    const spells = await book(edition)
    expect(spells.length).toBeGreaterThan(200)
    const ids = new Set<string>()
    for (const s of spells) {
      expect(ids.has(s.id), s.id).toBe(false)
      ids.add(s.id)
      expect(s).toMatchObject({ source: `books-${edition}`, edition })
      expect(s.level, s.id).toBeGreaterThanOrEqual(0)
      expect(s.level, s.id).toBeLessThanOrEqual(9)
      expect(SCHOOLS, s.id).toContain(s.school)
      expect(BOOK_TITLES[s.book!], s.id).toBeTruthy()
      for (const c of s.classes) expect(CLASSES, s.id).toContain(c)
      // Our own short summaries, never the book's text.
      expect(s.description.length, s.id).toBeGreaterThan(30)
      expect(s.description.length, s.id).toBeLessThan(260)
      expect(s.descriptionHe, s.id).toMatch(/[֐-׿]/)
    }
  })

  it.each(EDITIONS)('%s never repeats an SRD spell of the same edition', async edition => {
    const names = new Set((await srd(edition)).map(s => norm(s.name)))
    for (const s of await book(edition)) expect(names.has(norm(s.name)), s.name).toBe(false)
  })

  it('has the spells players asked for in both editions', async () => {
    const byEdition = Object.fromEntries(await Promise.all(EDITIONS.map(async e => [e, await loadKind('spells', { sources: spellSourcesFor(e) })]))) as Record<Edition, Spell[]>
    for (const id of ['hex', 'booming-blade', 'toll-the-dead', 'healing-spirit', 'shadow-blade', 'silvery-barbs']) {
      for (const e of EDITIONS) expect(byEdition[e].some(s => s.id === id), `${e} ${id}`).toBe(true)
    }
    const toll = byEdition['2024'].find(s => s.id === 'toll-the-dead')!
    expect(toll).toMatchObject({ book: 'XPHB', level: 0, save: { ability: 'wis' }, damage: { type: 'necrotic', byCharacterLevel: { 1: '1d8' } } })
    const hex = byEdition['2014'].find(s => s.id === 'hex')!
    expect(hex).toMatchObject({ book: 'PHB', classes: ['warlock'], concentration: true, castingTime: '1 bonus action' })
  })

  it.each(EDITIONS)('%s resolves every spell an official subclass grants', async edition => {
    const spells = await loadKind('spells', { sources: spellSourcesFor(edition) })
    const byName = new Map(spells.map(s => [norm(s.name), s.id]))
    const classes = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard', 'fighter', 'rogue', 'monk', 'barbarian']
    const missing = classes.flatMap(c => subclassesFor(c, edition)).flatMap(s => (s.spells ?? []).flatMap(l => l.names)).filter(n => !spellIdByName(byName, n))
    expect(missing).toEqual([])
  })

  it('cannot be posed as by an imported pack', () => {
    expect(BOOK_SOURCES.map(s => s.id)).toEqual(['books-2014', 'books-2024'])
    expect(sanitizePack({ format: 'ff-content', version: 1, source: { id: 'books-2014', title: 'Fake' }, entries: {} })).toBeNull()
  })
})
