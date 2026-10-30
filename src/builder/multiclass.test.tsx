import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { emptyDraft } from './Builder'
import { STEPS } from './steps'

const classStep = (edition: '2014' | '2024', classes: { classId: string; level: number }[]) => {
  const Step = STEPS.find(s => s.id === 'class')!.Component
  const html = renderToStaticMarkup(createElement(Step, { draft: { ...emptyDraft('u'), rulesEdition: edition === '2024' ? '2024' : undefined, classes }, update: () => {} }))
  const at = html.indexOf('class="multiclass"')
  return { main: html.slice(0, at), multiclass: html.slice(at) }
}

describe('multiclass picks', () => {
  it.each(['2014', '2024'] as const)('puts a second class subclass and options under its row (%s)', edition => {
    const { main, multiclass } = classStep(edition, [{ classId: 'artificer', level: 10 }, { classId: 'warlock', level: 10 }])
    expect(multiclass).toContain('multiclass-picks')
    expect(multiclass).toContain('Otherworldly Patron (Warlock)')
    expect(multiclass).toContain('Eldritch Invocations (Warlock)')
    expect(main).not.toContain('Warlock')
    expect(main).toContain('Artificer Specialist (Artificer)')
  })

  it('says when a low-level second class picks its subclass', () => {
    const { multiclass } = classStep('2014', [{ classId: 'wizard', level: 5 }, { classId: 'fighter', level: 1 }])
    expect(multiclass).toContain('You choose your Martial Archetype at level 3')
  })
})
