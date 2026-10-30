import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { emptyDraft } from '../builder/Builder'
import { STEPS } from '../builder/steps'
import { registerHomebrewClasses } from '../rules'
import { blankClass } from './pack'
import { toClass } from './store'
import { SubclassForm } from './ui/forms'

afterEach(() => registerHomebrewClasses([]))

describe('homebrew subclass editing', () => {
  it('the Homebrew subclass form has the same options as the builder Custom subclass', () => {
    const html = renderToStaticMarkup(createElement(SubclassForm, {
      initial: { id: '', name: 'Oath of Embers', classId: 'paladin', armor: [], features: [{ level: 3, name: 'Kindle' }] },
      onSave: () => {}, onCancel: () => {},
    }))
    for (const label of ['What it does', 'Uses', 'What it changes on your sheet', 'Bonus spells']) expect(html).toContain(label)
  })

  it('offers Custom for a homebrew class with no subclasses yet', () => {
    registerHomebrewClasses([toClass({ ...blankClass(), id: 'hb:abcd1234:rune-smith', name: 'Rune Smith', subclassLevel: 3, subclassTitle: 'Forge Tradition' })])
    const Step = STEPS.find(s => s.id === 'class')!.Component
    const html = renderToStaticMarkup(createElement(Step, { draft: { ...emptyDraft('u'), classes: [{ classId: 'hb:abcd1234:rune-smith', level: 3 }] }, update: () => {} }))
    expect(html).toContain('Custom Forge Tradition')
  })
})
