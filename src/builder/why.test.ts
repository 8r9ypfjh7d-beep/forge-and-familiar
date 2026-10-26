import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { CLASSES, RACES, SPECIES } from '../rules'
import { STEPS } from './steps'
import { WHY_TOPICS, pitchKey } from './why'

describe('why? tooltips', () => {
  it('explains every topic, step, race and class', () => {
    for (const id of WHY_TOPICS) expect(en, id).toHaveProperty([`why.${id}.text`])
    for (const s of STEPS) expect(WHY_TOPICS).toContain(`step.${s.id}`)
    for (const r of RACES) expect(pitchKey('race', r.id), r.id).toBeDefined()
    for (const r of SPECIES) expect(pitchKey('race2024', r.id), r.id).toBeDefined()
    for (const c of CLASSES) expect(pitchKey('class', c.id), c.id).toBeDefined()
    expect(pitchKey('race', 'homebrew-catfolk')).toBeUndefined()
  })
})
