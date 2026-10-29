import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { CLASSES, RACES } from '../rules'
import { alignmentAxis, backstoryText, draftBackstory, seededRandom, withBackstory } from './draft'
import { PHRASES } from './phrases'

const names = { race: 'Human', cls: 'Fighter', bg: 'Soldier' }

describe('backstory drafter', () => {
  it('is repeatable for a seed and changes with the next one', () => {
    const c = makeCharacter()
    expect(draftBackstory(c, names, 'en', 7)).toEqual(draftBackstory(c, names, 'en', 7))
    const texts = new Set([1, 2, 3, 4, 5].map(s => backstoryText(draftBackstory(c, names, 'en', s), 'en')))
    expect(texts.size).toBeGreaterThan(1)
  })

  it('uses the character, background and class, with no placeholders left', () => {
    const c = makeCharacter({ name: 'Mira', raceId: 'dwarf', backgroundId: 'soldier', classes: [{ classId: 'warlock', level: 1 }] })
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const b = draftBackstory(c, { ...names, race: 'Dwarf', cls: 'Warlock' }, 'en', seed)
      const text = backstoryText(b, 'en')
      expect(b.story[0]).toMatch(/^Mira is a dwarf/)
      expect(PHRASES.en.background.soldier.some(l => b.story[0].includes(l.replace(/\{name\}/g, 'Mira')))).toBe(true)
      expect(b.story[1]).toContain(PHRASES.en.calling.warlock[0].replace(/\{name\}/g, 'Mira'))
      expect(text).not.toMatch(/\{\w+\}/)
    }
  })

  it('falls back for homebrew races, unknown classes and custom backgrounds', () => {
    const c = makeCharacter({ name: 'Zee', raceId: 'hb-owlfolk', backgroundId: 'custom', classes: [{ classId: 'hb-witch', level: 1 }] })
    const b = draftBackstory(c, { race: 'Owlfolk', cls: 'Witch', bg: 'Sailor' }, 'en', 3)
    expect(b.story[0]).toContain('Owlfolk')
    expect(b.story[0]).toContain('a sailor')
    expect(b.story[1]).toContain('Witch')
  })

  it('picks the ideal from the alignment', () => {
    expect(alignmentAxis('Lawful Good')).toBe('good')
    expect(alignmentAxis('Chaotic Evil')).toBe('evil')
    expect(alignmentAxis('Lawful Neutral')).toBe('law')
    expect(alignmentAxis('Chaotic Neutral')).toBe('chaos')
    expect(alignmentAxis('True Neutral')).toBe('neutral')
    expect(alignmentAxis('')).toBe('neutral')
    const b = draftBackstory(makeCharacter({ alignment: 'Chaotic Neutral' }), names, 'en', 9)
    expect(PHRASES.en.ideals.chaos).toContain(b.ideal)
  })

  it('never repeats a trait in the personality line', () => {
    for (let seed = 0; seed < 200; seed++) {
      const [a, b] = draftBackstory(makeCharacter(), names, 'en', seed).personality.split(/(?<=\.) /)
      expect(a).not.toBe(b)
    }
  })

  it('has lines for every SRD race and class in every language, with matching tables', () => {
    for (const p of Object.values(PHRASES)) {
      for (const r of RACES) expect(p.race[r.id], r.id).toBeDefined()
      for (const c of CLASSES) expect(p.calling[c.id], c.id).toBeDefined()
      for (const id of ['goliath', 'orc', '*']) expect(p.race[id]).toBeDefined()
      for (const id of ['acolyte', 'criminal', 'sage', 'soldier', 'custom', '*']) expect(p.background[id]).toBeDefined()
    }
    const shape = (o: object) => Object.keys(o).sort()
    expect(shape(PHRASES.he.race)).toEqual(shape(PHRASES.en.race))
    expect(shape(PHRASES.he.calling)).toEqual(shape(PHRASES.en.calling))
    expect(shape(PHRASES.he.background)).toEqual(shape(PHRASES.en.background))
  })

  it('writes Hebrew with Hebrew labels', () => {
    const text = backstoryText(draftBackstory(makeCharacter({ name: 'מירה' }), { race: 'אדם', cls: 'לוחם', bg: 'חייל' }, 'he', 2), 'he')
    expect(text).toContain('מירה')
    expect(text).toContain('אידיאל:')
    expect(text).not.toMatch(/\{\w+\}/)
  })

  it('adds the draft below existing notes', () => {
    expect(withBackstory('', 'Story')).toBe('Story')
    expect(withBackstory('Owes Garrick 5 gp\n', 'Story')).toBe('Owes Garrick 5 gp\n\nStory')
  })

  it('seeded random stays in [0, 1)', () => {
    const r = seededRandom(42)
    for (let i = 0; i < 1000; i++) { const x = r(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1) }
  })
})
