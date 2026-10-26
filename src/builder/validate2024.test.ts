import { describe, expect, it } from 'vitest'
import type { CharacterDraft } from '../rules'
import { stepIssues } from './validate'

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test',
  ownerId: 'u1',
  playerName: '',
  alignment: 'True Neutral',
  rulesEdition: '2024',
  raceId: 'orc',
  backgroundId: 'soldier',
  classes: [{ classId: 'fighter', level: 1 }],
  abilityMethod: 'standard',
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  freeAbilityBonuses: ['str', 'str', 'con'],
  chosenSkills: ['acrobatics', 'perception'],
  ...over,
})

describe('2024 builder checks', () => {
  it('needs the background bonuses, an Origin feat for Humans and class choices', () => {
    expect(stepIssues('abilities', draft({ freeAbilityBonuses: ['str'] }))).toContain("Give your background's abilities +2/+1 or +1/+1/+1.")
    expect(stepIssues('abilities', draft())).toEqual([])
    expect(stepIssues('race', draft({ raceId: 'human' }))).toContain('Pick an Origin feat.')
    expect(stepIssues('race', draft({ raceId: 'human', originFeatId: 'skilled' }))).toEqual([])
    expect(stepIssues('class', draft())).toContain('Pick a Fighting Style for your Fighter.')
    expect(stepIssues('class', draft({ featureChoices: { 'fighter.fightingStyle': 'archery' } }))).toEqual([])
  })

  it('counts Skilled as three extra skill picks', () => {
    const d = draft({ raceId: 'human', originFeatId: 'skilled', chosenSkills: ['acrobatics', 'perception', 'arcana', 'history', 'nature', 'religion'], chosenLanguages: ['Elvish', 'Giant'], chosenTools: ['Dice set'] })
    expect(stepIssues('skills', d)).toEqual([])
  })
})
