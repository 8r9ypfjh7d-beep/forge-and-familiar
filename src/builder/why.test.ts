import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import {
  ABILITIES, ALIGNMENTS, ALL_SKILLS, BACKGROUNDS, BOOK_BACKGROUNDS_2024, BOOK_SPECIES_2024, BOOK_SUBCLASSES, BOOK_SUBCLASSES_2024, BACKGROUNDS_2024, CLASSES, CLASSES_2024, LANGUAGES, RACES, SPECIES,
  SUBCLASSES, SUBCLASSES_2024, TOOLS, allFeats, CLASS_CHOICES_2014,
} from '../rules'
import { he } from '../i18n/locales/he'
import { STEPS } from './steps'
import { WHY_TOPICS, explainKey, featExplainKey, featureKey, choiceOptionKey, choiceTopic, pitchKey, type ExplainKind } from './why'

// SRD 5.2 species and the 2024 species from other books.
const SPECIES_ALL = [...SPECIES, ...BOOK_SPECIES_2024]

const missing = (kind: ExplainKind, ids: string[]) => [...new Set(ids)].filter(id => !explainKey(kind, id))

describe('why? tooltips', () => {
  it('explains every topic, step, race and class', () => {
    for (const id of WHY_TOPICS) expect(en, id).toHaveProperty([`why.${id}.text`])
    for (const s of STEPS) expect(WHY_TOPICS).toContain(`step.${s.id}`)
    for (const r of RACES) expect(pitchKey('race', r.id), r.id).toBeDefined()
    for (const r of SPECIES_ALL) expect(pitchKey('race2024', r.id), r.id).toBeDefined()
    for (const c of CLASSES) expect(pitchKey('class', c.id), c.id).toBeDefined()
    expect(pitchKey('race', 'homebrew-catfolk')).toBeUndefined()
  })

  // Every option the builder offers, in both editions, has a plain-language line (Hebrew is checked in i18n.test.ts).
  it('explains every class, subclass, feature and class choice', () => {
    const classes = [...CLASSES, ...CLASSES_2024]
    const subclasses = [...SUBCLASSES, ...SUBCLASSES_2024, ...BOOK_SUBCLASSES, ...BOOK_SUBCLASSES_2024]
    expect(missing('about', classes.map(c => c.id))).toEqual([])
    expect(missing('subclass', subclasses.map(s => s.id))).toEqual([])
    expect(missing('feature', classes.flatMap(c => c.features.map(f => f.name)))).toEqual([])
    expect(subclasses.flatMap(s => s.features.filter(f => !featureKey(f.name, s.id)).map(f => `${s.id}: ${f.name}`))).toEqual([])
    for (const ch of [...classes.flatMap(c => c.choices ?? []), ...Object.values(CLASS_CHOICES_2014).flat()]) expect(WHY_TOPICS).toContain(choiceTopic(ch))
  })

  // Every 2014 pick explains each option (keeping the base rules needs none) and has a Hebrew name.
  it('explains and names every 2014 class pick', () => {
    const choices = Object.values(CLASS_CHOICES_2014).flat()
    expect(choices.flatMap(ch => ch.options.filter(o => o.id !== 'phb' && !choiceOptionKey(ch, o)).map(o => `${ch.id}: ${o.id}`))).toEqual([])
    const names = choices.flatMap(ch => [
      `feature.${ch.name}`,
      ...ch.options.filter(o => o.id !== 'phb').map(o => (o.id === 'use' ? `feature.${o.name}` : o.effects?.some(e => e.kind === 'skillProficiency') ? `skill.${o.id}` : `pick.${o.id}`)),
    ])
    expect([...new Set(names)].filter(k => !(k in he.terms))).toEqual([])
  })

  it('explains every subrace, lineage and trait', () => {
    expect(missing('sub2014', RACES.flatMap(r => (r.subraces ?? []).map(s => s.id)))).toEqual([])
    expect(missing('sub2024', SPECIES_ALL.flatMap(r => (r.subraces ?? []).map(s => s.id)))).toEqual([])
    expect(missing('trait', [...RACES, ...SPECIES_ALL].flatMap(r => [...r.traits, ...(r.subraces ?? []).flatMap(s => s.traits)]))).toEqual([])
  })

  it('explains every background, ability, skill, alignment, language and tool', () => {
    expect(missing('bg', BACKGROUNDS.map(b => b.id))).toEqual([])
    expect(missing('bg2024', [...BACKGROUNDS_2024, ...BOOK_BACKGROUNDS_2024].map(b => b.id))).toEqual([])
    expect(missing('ability', [...ABILITIES])).toEqual([])
    expect(missing('skill', ALL_SKILLS)).toEqual([])
    expect(missing('align', ALIGNMENTS)).toEqual([])
    expect(missing('language', LANGUAGES)).toEqual([])
    expect(missing('tool', TOOLS)).toEqual([])
  })

  it('explains every official feat in both editions', () => {
    expect(allFeats('2014').filter(f => !featExplainKey(f.id, '2014')).map(f => f.id)).toEqual([])
    expect(allFeats('2024').filter(f => !featExplainKey(f.id, '2024')).map(f => f.id)).toEqual([])
    expect(featExplainKey('alert', '2024')).toBe('why.feat2024.alert')
    expect(featExplainKey('gunner', '2024')).toBe('why.feat.gunner')
  })

  it('has no explanation for homebrew, so the builder says to ask the DM', () => {
    expect(explainKey('feature', 'Homebrew Thing')).toBeUndefined()
    expect(explainKey('tool', "Smith's tools")).toBe('why.tool.artisan')
  })
})
