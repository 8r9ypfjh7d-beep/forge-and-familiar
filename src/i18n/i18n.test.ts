import { describe, expect, it } from 'vitest'
import { stepIssues } from '../builder/validate'
import { emptyDraft } from '../builder/Builder'
import { ALIGNMENTS, BACKGROUNDS, BOOK_RACES, BOOK_SPECIES_2024, BOOK_SUBRACES, CLASSES, LANGUAGES, RACES, SKILLS, TOOLS, backgroundsFor, classesFor, subclassesFor } from '../rules'
import { en } from './locales/en'
import { he } from './locales/he'
import { LOCALES, term, translate } from './translate'

describe('translate', () => {
  it('fills vars and falls back to English, then to the key', () => {
    expect(translate('en', 'list.title', { name: 'Ziv' })).toBe("Ziv's characters")
    expect(translate('he', 'list.title', { name: 'Ziv' })).toBe('הדמויות של Ziv')
    expect(translate('he', 'nope' as never)).toBe('nope')
  })

  it('picks plural forms, including the Hebrew dual', () => {
    expect(translate('en', 'party.members', { count: 1 })).toBe('1 member')
    expect(translate('en', 'party.members', { count: 3 })).toBe('3 members')
    expect(translate('he', 'party.members', { count: 1 })).toBe('חבר אחד')
    expect(translate('he', 'party.members', { count: 2 })).toBe('שני חברים')
    expect(translate('he', 'party.members', { count: 7 })).toBe('7 חברים')
  })

  it('keeps the English name for unknown terms', () => {
    expect(term('he', 'class', 'fighter', 'Fighter')).toBe('לוחם')
    expect(term('he', 'item', 'homebrew-sword', 'Moonblade')).toBe('Moonblade')
  })

  it('marks Hebrew as right-to-left', () => {
    expect(LOCALES.he.dir).toBe('rtl')
    expect(LOCALES.en.dir).toBe('ltr')
  })

  it('validates in the chosen language without changing the English default', () => {
    const d = emptyDraft('u1')
    expect(stepIssues('race', d)).toEqual(['Choose a race.'])
    expect(stepIssues('race', d, (k, v) => translate('he', k, v))).toEqual(['בחרו גזע.'])
  })

  it('names the subclass title and class in Hebrew issues', () => {
    const d = { ...emptyDraft('u1'), classes: [{ classId: 'cleric', level: 1 }] }
    const he = (k: Parameters<typeof translate>[1], v?: Parameters<typeof translate>[2]) => translate('he', k, v)
    const issues = stepIssues('class', d, he, (kind, id, name) => term('he', kind, id, name)).join(' ')
    expect(issues).toContain('תחום אלוהי')
    expect(issues).not.toMatch(/Divine Domain|Cleric/)
  })
})

describe('Hebrew coverage', () => {
  it('translates every UI string', () => {
    const missing = Object.keys(en).filter(k => !(k in he.messages))
    expect(missing).toEqual([])
  })

  // Items are left out: new gear can land before its translation and shows in English meanwhile.
  it('names every SRD race, class, skill and alignment', () => {
    const ids = [
      ...RACES.flatMap(r => [`race.${r.id}`, ...(r.subraces ?? []).map(s => `race.${s.id}`)]),
      ...[...BOOK_RACES['2014'], ...BOOK_SUBRACES['2014']].map(r => `race.${r.id}`),
      ...CLASSES.map(c => `class.${c.id}`),
      ...BOOK_SPECIES_2024.flatMap(r => [`race.${r.id}`, ...r.traits.map(x => `trait.${x}`)]),
      ...Object.keys(SKILLS).map(s => `skill.${s}`),
      ...ALIGNMENTS.map(a => `alignment.${a}`),
      ...BACKGROUNDS.flatMap(b => [`background.${b.id}`, `bgFeature.${b.feature}`]),
    ]
    expect(ids.filter(k => !(k in he.terms))).toEqual([])
  })

  it('names every language and tool', () => {
    const ids = [...LANGUAGES.map(l => `language.${l}`), ...TOOLS.map(x => `tool.${x}`)]
    expect(ids.filter(k => !(k in he.terms))).toEqual([])
  })

  // Every official subclass feature and subclass title, in both editions, has a Hebrew name.
  it('names every subclass feature and subclass title', () => {
    const editions = ['2014', '2024'] as const
    const classes = editions.flatMap(ed => classesFor(ed).map(c => ({ c, ed })))
    const ids = [
      ...classes.map(({ c }) => `feature.${c.subclassTitle}`),
      ...classes.flatMap(({ c, ed }) => subclassesFor(c.id, ed).flatMap(s => s.features.map(f => `feature.${f.name}`))),
    ]
    expect([...new Set(ids)].filter(k => !(k in he.terms))).toEqual([])
  })

  it('names every 2024 background', () => {
    expect(backgroundsFor('2024').map(b => `background.${b.id}`).filter(k => !(k in he.terms))).toEqual([])
  })
})
