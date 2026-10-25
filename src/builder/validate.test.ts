import { describe, expect, it } from 'vitest'
import { emptyDraft } from './Builder'
import { stepIssues } from './validate'

const base = () => ({ ...emptyDraft('u1'), raceId: 'half-elf', classes: [{ classId: 'rogue', level: 1 }] })

describe('builder validation', () => {
  it('requires a subrace when the race has one', () => {
    expect(stepIssues('race', { ...base(), raceId: 'dwarf' })).toHaveLength(1)
    expect(stepIssues('race', { ...base(), raceId: 'dwarf', subraceId: 'hill-dwarf' })).toEqual([])
  })

  it('checks the standard array and half-elf picks', () => {
    const d = { ...base(), baseAbilities: { str: 8, dex: 15, con: 14, int: 12, wis: 10, cha: 13 } }
    expect(stepIssues('abilities', d)).toEqual(['Pick 2 abilities for your racial +1.'])
    expect(stepIssues('abilities', { ...d, freeAbilityBonuses: ['dex', 'con'] })).toEqual([])
    expect(stepIssues('abilities', { ...d, baseAbilities: { ...d.baseAbilities, str: 15 }, freeAbilityBonuses: ['dex', 'con'] })).toHaveLength(1)
  })

  it('counts class and free race skill picks', () => {
    // Rogue picks 4 from its list, half-elf adds 2 of any kind; acolyte grants insight + religion.
    const picks = ['stealth', 'acrobatics', 'deception', 'perception', 'arcana', 'history'] as const
    expect(stepIssues('skills', { ...base(), chosenSkills: [...picks] })).toEqual([])
    expect(stepIssues('skills', { ...base(), chosenSkills: [...picks.slice(0, 5)] })).toHaveLength(1)
    expect(stepIssues('skills', { ...base(), chosenSkills: [...picks.slice(0, 5), 'insight'] })).toHaveLength(1)
  })

  it('blocks the abilities step when a multiclass prerequisite is missing', () => {
    const d = { ...base(), raceId: 'human', classes: [{ classId: 'rogue', level: 3 }, { classId: 'wizard', level: 2 }], abilityMethod: 'manual' as const }
    const scores = { str: 8, dex: 14, con: 12, int: 11, wis: 10, cha: 10 }
    expect(stepIssues('abilities', { ...d, baseAbilities: scores })).toEqual(['To multiclass, Wizard needs INT 13.'])
    expect(stepIssues('abilities', { ...d, baseAbilities: { ...scores, int: 12 } })).toEqual([])
  })
})
