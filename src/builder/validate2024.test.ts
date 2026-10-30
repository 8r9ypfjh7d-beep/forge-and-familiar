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
    expect(stepIssues('class', draft())).toContain('Pick the Fighting Style for your Fighter.')
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

  it('needs Expertise and Weapon Mastery picks, and only warns about off-list ones', () => {
    const rogue = draft({ classes: [{ classId: 'rogue', level: 1 }], chosenSkills: ['stealth', 'acrobatics', 'deception', 'insight'], chosenLanguages: ['Elvish'] })
    expect(stepIssues('skills', rogue)).toContain('Rogue: pick 2 for Expertise.')
    const picked = { ...rogue, classPicks: { 'rogue.expertise': ['stealth', 'insight'] } }
    expect(stepIssues('skills', picked).filter(i => i.includes('Expertise'))).toEqual([])
    expect(stepIssues('skills', rogue)).toContain("Pick 3 languages you don't already know.")
    expect(stepWarnings('skills', picked)).toEqual([])
    expect(stepWarnings('skills', { ...rogue, classPicks: { 'rogue.expertise': ['stealth', 'arcana'] } })[0]).toMatch(/Expertise/)
    expect(stepIssues('equipment', draft())).toEqual(['Pick 3 weapons for Weapon Mastery.'])
    expect(stepIssues('equipment', draft({ weaponMasteries: ['longsword', 'longbow', 'dagger'] }))).toEqual([])
    const barb = draft({ classes: [{ classId: 'barbarian', level: 1 }], weaponMasteries: ['greataxe', 'longbow'] })
    expect(stepIssues('equipment', barb)).toEqual([])
    expect(stepWarnings('equipment', barb)).toHaveLength(1)
  })
})
