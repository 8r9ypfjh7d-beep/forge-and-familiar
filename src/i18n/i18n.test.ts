import { describe, expect, it } from 'vitest'
import { stepIssues } from '../builder/validate'
import { emptyDraft } from '../builder/Builder'
import { ITEMS, ALIGNMENTS, BACKGROUNDS, BOOK_FEATS, BOOK_FEATS_2024, BOOK_RACES, BOOK_SPECIES_2024, BOOK_SUBRACES, CLASSES, CLASSES_2024, LANGUAGES, RACES, SKILLS, TOOLS, allRaces, backgroundsFor, classesFor, subclassesFor } from '../rules'
import { en } from './locales/en'
import { he } from './locales/he'
import { LOCALES, spellTermId, term, translate } from './translate'
import { spellMeasureHe } from './locales/spells.he'
import { spellNoteHe } from './locales/notes.he'
import { loadKind } from '../content'

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

  // Every spell in the library (SRD and book spells, both editions) has a Hebrew name, found by id or English name.
  it('names every spell', async () => {
    const spells = await loadKind('spells')
    expect(spells.length).toBeGreaterThan(500)
    expect([...new Set(spells.map(sp => `spell.${spellTermId(sp.name)}`))].filter(k => !(k in he.terms))).toEqual([])
    expect([...new Set(spells.map(sp => `spell.${sp.id}`))].filter(k => !(k in he.terms))).toEqual([])
  })

  // Every SRD monster (both editions) has a Hebrew name by id. Book and pack monsters carry their own `nameHe`.
  it('names every SRD monster', async () => {
    const monsters = await loadKind('monsters', { sources: ['srd-5.1', 'srd-5.2'] })
    expect(monsters.length).toBeGreaterThan(600)
    expect([...new Set(monsters.map(m => `monster.${m.id}`))].filter(k => !(k in he.terms))).toEqual([])
    for (const k of Object.keys(he.terms)) if (k.startsWith('monster.')) expect(he.terms[k], k).toMatch(/[֐-׿]/)
  })

  it('translates every spell casting time, range and duration', async () => {
    const spells = await loadKind('spells')
    const texts = [...new Set(spells.flatMap(sp => [sp.castingTime, sp.range, sp.duration]))]
    expect(texts.filter(x => /[a-z]{3}/i.test(spellMeasureHe(x)))).toEqual([])
    expect(spellMeasureHe('1 action')).toBe('פעולה')
    expect(spellMeasureHe('Self (30-foot cone)')).toBe('עצמי (חרוט 30 רגל)')
    expect(spellMeasureHe('up to 1 minute')).toBe('עד דקה')
    expect(spellMeasureHe('60 feet')).toBe('60 רגל')
    expect(spellMeasureHe('Homebrew time')).toBe('Homebrew time')
  })

  it('names every rules-engine item', () => {
    expect(ITEMS.map(i => `item.${i.id}`).filter(k => !(k in he.terms))).toEqual([])
  })

  it('names every 2024 background', () => {
    expect(backgroundsFor('2024').map(b => `background.${b.id}`).filter(k => !(k in he.terms))).toEqual([])
  })

  // The sheet's Features & Traits, resources and turn rows list these by English name.
  it('names every class feature and racial trait in both editions', () => {
    const hebrew = (kind: string, name: string) => /[\u0590-\u05ff]/.test(term('he', kind, name, name))
    const features = [...CLASSES, ...CLASSES_2024].flatMap(c => c.features.map(f => f.name))
    const traits = (['2014', '2024'] as const).flatMap(e => allRaces(e).flatMap(r => [...r.traits, ...(r.subraces ?? []).flatMap(x => x.traits)]))
    expect([...new Set(features)].filter(n => !hebrew('feature', n))).toEqual([])
    expect([...new Set(traits)].filter(n => !hebrew('trait', n) && !hebrew('trait', n.replace(/\s*\(.*\)$/, '')))).toEqual([])
  })

  it('names every book feat', () => {
    expect([...BOOK_FEATS, ...BOOK_FEATS_2024].map(f => `feat.${f.id}`).filter(k => !(k in he.terms))).toEqual([])
  })

  it('finds names across kinds: resources by their feature, traits that are spells', () => {
    expect(term('he', 'resource', 'trait:large-form', 'Large Form')).toBe('צורה גדולה')
    expect(term('he', 'feature', 'Relentless Endurance', 'Relentless Endurance')).toBe(term('he', 'trait', 'Relentless Endurance', '?'))
    expect(term('he', 'trait', 'Speak with Animals', 'Speak with Animals')).toBe(he.terms[`spell.${spellTermId('Speak with Animals')}`])
    expect(term('en', 'resource', 'trait:large-form', 'Large Form')).toBe('Large Form')
  })

  it('translates spell notes part by part', () => {
    expect(spellNoteHe('at will')).toBe('כרצונכם')
    expect(spellNoteHe('once per long rest, deals cold damage')).toBe('פעם במנוחה ארוכה, גורם נזק קור')
    expect(spellNoteHe('proficiency bonus times per long rest')).not.toMatch(/[a-z]/)
    expect(spellNoteHe('3 charges')).toBe('3 מטענים')
    expect(spellNoteHe('when the moon is full')).toBe('when the moon is full')
  })
})
