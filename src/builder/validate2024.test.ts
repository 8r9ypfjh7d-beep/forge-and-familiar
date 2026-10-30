import { describe, expect, it } from 'vitest'
import type { CharacterDraft } from '../rules'
import { stepIssues, stepWarnings } from './validate'

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
    expect(stepIssues('abilities', draft({ freeAbilityBonuses: ['str'] }))).toContain('Give your background bonuses: +2 and +1, or +1 to three abilities.')
    expect(stepIssues('abilities', draft({ freeAbilityBonuses: ['str', 'str', 'str'] }))).toHaveLength(1)
    expect(stepIssues('abilities', draft())).toEqual([])
    expect(stepWarnings('abilities', draft())).toEqual([])
    expect(stepIssues('race', draft({ raceId: 'human' }))).toContain('Pick an Origin feat.')
    expect(stepIssues('race', draft({ raceId: 'human', originFeatId: 'skilled' }))).toEqual([])
    expect(stepIssues('class', draft())).toContain('Pick a Fighting Style for your Fighter.')
    expect(stepIssues('class', draft({ featureChoices: { 'fighter.fightingStyle': 'archery' } }))).toEqual([])
  })

  it('lets background bonuses go to any ability, with a note', () => {
    const d = draft({ freeAbilityBonuses: ['cha', 'cha', 'wis'] })
    expect(stepIssues('abilities', d)).toEqual([])
    expect(stepWarnings('abilities', d)).toEqual(["Soldier doesn't usually raise CHA, WIS. Fine if your DM agrees."])
  })

  it('counts Skilled as three extra skill picks', () => {
    const d = draft({ raceId: 'human', originFeatId: 'skilled', chosenSkills: ['acrobatics', 'perception', 'arcana', 'history', 'nature', 'religion'], chosenLanguages: ['Elvish', 'Giant'], chosenTools: ['Dice set'] })
    expect(stepIssues('skills', d)).toEqual([])
  })
})
