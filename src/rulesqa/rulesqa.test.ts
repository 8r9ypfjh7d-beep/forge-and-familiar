/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import corpus from './data/srd-rules.json'
import { answer, breadcrumb, buildIndex, expandQuery, sentences, stem } from './search'
import type { RulesCorpus } from './types'

const index = buildIndex(corpus as RulesCorpus)
const top = (q: string) => answer(index, q).best?.passage.path.at(-1)

describe('stem', () => {
  it('folds common word forms together', () => {
    expect(stem('grappled')).toBe(stem('grappling'))
    expect(stem('grapple')).toBe(stem('grappling'))
    expect(stem('saves')).toBe(stem('saving'))
    expect(stem('attunement')).toBe(stem('attune'))
    expect(stem('concentration')).toBe(stem('concentrate'))
  })
})

describe('expandQuery', () => {
  it('drops question words and expands table talk', () => {
    const q = expandQuery('what is my AC?')
    expect(q.own).toEqual(['ac'])
    expect(q.extra).toEqual(expect.arrayContaining(['armor', 'class']))
    expect(q.plain).toEqual([])
  })
})

describe('answer', () => {
  it.each([
    ['How does grappling work?', 'Grappling'],
    ['when do I get an opportunity attack', 'Opportunity Attacks'],
    ['what happens when I drop to 0 hp', 'Dropping to 0 Hit Points'],
    ['how do death saves work', 'Death Saving Throws'],
    ['can I dual wield', 'Two-Weapon Fighting'],
    ['what does a long rest restore', 'Long Rest'],
    ['how long can I hold my breath', 'Suffocating'],
    ['how does falling damage work', 'Falling'],
    ['what does prone do', 'Prone'],
    ['can I cast in armor', 'Casting in Armor'],
    ['what happens on a nat 20', 'Rolling 1 or 20'],
    ['how many magic items can I attune', 'Attunement'],
  ])('%s → %s', (q, heading) => {
    expect(top(q)).toBe(heading)
  })

  it('quotes the sentence that answers the question', () => {
    const a = answer(index, 'do I add my modifier to off-hand damage')
    expect(a.excerpt).toContain("You don't add your ability modifier to the damage of the bonus attack")
    expect(a.weak).toBe(false)
  })

  it('shows a table row under its header', () => {
    const a = answer(index, 'how many gp in a platinum piece')
    expect(a.excerpt.split('\n')[0]).toMatch(/^\| Coin/)
  })

  it('finds nothing for off-topic questions', () => {
    expect(answer(index, 'banana pancakes').best).toBeNull()
    expect(answer(index, 'what?').best).toBeNull()
  })

  it('does not repeat the best passage in related', () => {
    const a = answer(index, 'what is difficult terrain')
    const crumbs = a.related.map(h => breadcrumb(h.passage))
    expect(crumbs).not.toContain(breadcrumb(a.best!.passage))
    expect(new Set(crumbs).size).toBe(crumbs.length)
  })
})

describe('sentences', () => {
  it('splits prose and keeps table rows and list items whole', () => {
    expect(sentences('One. Two!\n- a list item. Still it.\n| a | b |\n|---|---|\n| 1 | 2 |'))
      .toEqual(['One.', 'Two!', '- a list item. Still it.', '| a | b |', '| 1 | 2 |'])
  })
})

describe('corpus', () => {
  it('covers the SRD rules chapters and all 15 conditions', () => {
    const passages = (corpus as RulesCorpus).passages
    expect(passages.filter(p => p.chapter === 'Conditions')).toHaveLength(15)
    for (const ch of ['Combat', 'Spellcasting', 'Adventuring', 'Equipment', 'Using Ability Scores']) {
      expect(passages.some(p => p.chapter === ch)).toBe(true)
    }
    expect(new Set(passages.map(p => p.id)).size).toBe(passages.length)
  })
})

describe('styles', () => {
  // ?raw imports of CSS come back empty under Vitest, so read the files themselves.
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')

  it('uses logical properties only, so RTL needs no overrides', () => {
    for (const f of ['./rulesqa.css', './search-field.css']) {
      expect(read(f)).not.toMatch(/(margin|padding|border)-(left|right|top|bottom)|\b(left|right):/)
    }
  })

  it('keeps the CC-BY source line styled visible', () => {
    expect(read('./rulesqa.css')).not.toMatch(/\.source[^{]*\{[^}]*display:\s*none/)
  })
})
