import { describe, expect, it } from 'vitest'
import type { CharacterDraft } from '../rules'
import { suggestedSkills } from './suggest'
import { skillPicks, stepIssues, stepWarnings, suggestedForPick } from './validate'
import { classPickSlots } from '../rules'

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  rulesEdition: '2024', raceId: 'elf', subraceId: 'drow', backgroundId: 'soldier',
  classes: [{ classId: 'fighter', level: 1 }],
  abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  freeAbilityBonuses: ['str', 'str', 'con'], chosenSkills: [], chosenTools: ['Dice set'], chosenLanguages: ['Dwarvish', 'Giant'],
  ...over,
})

describe('2024 Elf Keen Senses', () => {
  it('counts one pick from Insight, Perception or Survival', () => {
    expect(skillPicks(draft())).toMatchObject({ classCount: 2, raceCount: 0, raceListCount: 1, raceFrom: ['insight', 'perception', 'survival'] })
    expect(stepIssues('skills', draft({ chosenSkills: ['acrobatics', 'history', 'perception'] }))).toEqual([])
    expect(stepIssues('skills', draft({ chosenSkills: ['acrobatics', 'history'] }))).toContain('Pick 1 skills from your race list.')
  })

  it('warns, without blocking, on a skill off every list', () => {
    const d = draft({ chosenSkills: ['acrobatics', 'history', 'arcana'] })
    expect(stepIssues('skills', d)).toEqual([])
    expect(stepWarnings('skills', d)).toContain('Some skills are not on your class or background list. Fine if your DM agrees.')
  })

  it('Suggest takes the Keen Senses skill from its list', () => {
    const skills = suggestedSkills(draft())
    expect(skills).toHaveLength(3)
    expect(skills.some(s => ['insight', 'perception', 'survival'].includes(s))).toBe(true)
    // A Ranger whose class list holds all three still keeps one for Keen Senses.
    const ranger = suggestedSkills(draft({ classes: [{ classId: 'ranger', level: 1 }] }))
    expect(ranger).toHaveLength(4)
    expect(stepIssues('skills', draft({ classes: [{ classId: 'ranger', level: 1 }], chosenSkills: ranger }))).toEqual([])
  })
})

describe('Rogue Expertise with thieves\' tools', () => {
  const rogue = (edition: '2014' | '2024', picks: string[]) => draft({
    rulesEdition: edition === '2024' ? '2024' : undefined, raceId: 'human', subraceId: undefined, backgroundId: 'acolyte', freeAbilityBonuses: edition === '2024' ? ['dex', 'dex', 'con'] : [],
    classes: [{ classId: 'rogue', level: 1 }], chosenSkills: ['stealth', 'acrobatics', 'deception', 'perception'],
    classPicks: { 'rogue.expertise': picks },
  })

  it('offers the tool in 2014 and warns only in 2024', () => {
    const [slot14] = classPickSlots(rogue('2014', []))
    expect(slot14.pick.tools).toEqual(["Thieves' tools"])
    expect(suggestedForPick(rogue('2014', []), slot14.pick)).toContain("Thieves' tools")
    expect(stepWarnings('skills', rogue('2014', ['stealth', "Thieves' tools"])).some(w => w.startsWith('Expertise'))).toBe(false)
    const [slot24] = classPickSlots(rogue('2024', []))
    expect(suggestedForPick(rogue('2024', []), slot24.pick)).not.toContain("Thieves' tools")
    expect(stepWarnings('skills', rogue('2024', ['stealth', "Thieves' tools"])).some(w => w.startsWith('Expertise'))).toBe(true)
  })
})
