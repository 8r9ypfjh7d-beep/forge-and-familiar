import { describe, expect, it } from 'vitest'
import { emptyDraft } from './Builder'
import { stepIssues } from './validate'
import { createCharacter, derive } from '../rules'

const base = () => ({ ...emptyDraft('u1'), raceId: 'half-elf', classes: [{ classId: 'rogue', level: 1 }], chosenLanguages: ['Dwarvish', 'Giant', 'Orc'] })

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

  it('only warns, never blocks, when a multiclass prerequisite is missing', () => {
    const d = { ...base(), raceId: 'human', classes: [{ classId: 'rogue', level: 3 }, { classId: 'wizard', level: 2 }], abilityMethod: 'manual' as const }
    const scores = { str: 8, dex: 14, con: 12, int: 11, wis: 10, cha: 10 }
    expect(stepIssues('abilities', { ...d, baseAbilities: scores })).toEqual([])
    expect(derive(createCharacter({ ...d, baseAbilities: scores })).warnings).toContain('Multiclass prerequisite not met: Wizard needs INT 13.')
  })

  it('asks for language picks from race and background', () => {
    const picks = ['stealth', 'acrobatics', 'deception', 'perception', 'arcana', 'history'] as const
    const d = { ...base(), chosenSkills: [...picks] }
    expect(stepIssues('skills', { ...d, chosenLanguages: ['Dwarvish', 'Giant'] })).toEqual(['Pick 3 languages you don\'t already know.'])
    expect(stepIssues('skills', { ...d, chosenLanguages: ['Dwarvish', 'Giant', 'Elvish'] })).toHaveLength(1)
    expect(stepIssues('skills', { ...d, chosenLanguages: ['Dwarvish', 'Giant', 'Giant'] })).toHaveLength(1)
  })

  it('validates the custom background rule', () => {
    const d = {
      ...base(), raceId: 'human', classes: [{ classId: 'fighter', level: 1 }], backgroundId: 'custom',
      chosenSkills: ['athletics', 'perception'] as ('athletics' | 'perception')[], chosenLanguages: ['Orc'],
      customBackground: { name: 'Soldier', feature: 'Military Rank', skills: ['intimidation', 'survival'] as ('intimidation' | 'survival')[], tools: ['Dice set', 'Vehicles (land)'], languages: [] },
    }
    expect(stepIssues('skills', d)).toEqual([])
    expect(stepIssues('skills', { ...d, customBackground: { ...d.customBackground, tools: ['Dice set'] } })).toEqual(['Pick two tools or languages for your custom background.'])
    expect(stepIssues('skills', { ...d, customBackground: { ...d.customBackground, tools: ['Dice set'], languages: ['Elvish'] }, chosenLanguages: ['Orc'] })).toEqual([])
    expect(stepIssues('skills', { ...d, customBackground: { ...d.customBackground, skills: ['intimidation'] } })).toHaveLength(1)
    // A class pick can't repeat a background skill.
    expect(stepIssues('skills', { ...d, chosenSkills: ['athletics', 'survival'] })).toContain('A chosen skill is already granted by race or background.')
  })

  it('needs tool picks for dwarves and bards', () => {
    const d = { ...base(), raceId: 'dwarf', subraceId: 'hill-dwarf', classes: [{ classId: 'bard', level: 1 }], chosenSkills: ['stealth', 'arcana', 'history'] as ('stealth' | 'arcana' | 'history')[], chosenLanguages: ['Elvish', 'Giant'] }
    expect(stepIssues('skills', d)).toEqual(['Pick your tool proficiencies.'])
    expect(stepIssues('skills', { ...d, chosenTools: ["Mason's tools", 'Lute', 'Drum', 'Viol'] })).toEqual([])
    expect(stepIssues('skills', { ...d, chosenTools: ['Lute', "Mason's tools", 'Drum', 'Viol'] })).toHaveLength(1)
  })

  it('requires a subclass at the right level and dragonborn ancestry', () => {
    expect(stepIssues('class', { ...base(), classes: [{ classId: 'rogue', level: 2 }] })).toEqual([])
    expect(stepIssues('class', { ...base(), classes: [{ classId: 'rogue', level: 3 }] })).toEqual(['Choose a Roguish Archetype for your Rogue.'])
    expect(stepIssues('class', { ...base(), classes: [{ classId: 'rogue', level: 3, subclassId: 'thief' }] })).toEqual([])
    expect(stepIssues('class', { ...base(), classes: [{ classId: 'rogue', level: 3, subclassId: 'champion' }] })).toHaveLength(1)
    expect(stepIssues('race', { ...base(), raceId: 'dragonborn' })).toEqual(['Choose your Draconic Ancestry.'])
    expect(stepIssues('race', { ...base(), raceId: 'dragonborn', traitChoices: { draconicAncestry: 'red' } })).toEqual([])
  })

  it('requires each Ability Score Improvement', () => {
    const d = {
      ...base(), raceId: 'human', classes: [{ classId: 'fighter', level: 6 }], abilityMethod: 'manual' as const,
      baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    }
    expect(stepIssues('abilities', d)).toHaveLength(2)
    const improvements = [{ classId: 'fighter', level: 4, abilities: { str: 2 } }, { classId: 'fighter', level: 6, featId: 'grappler' }]
    expect(stepIssues('abilities', { ...d, improvements })).toEqual([])
    expect(stepIssues('abilities', { ...d, improvements: [improvements[0], { classId: 'fighter', level: 6, abilities: { str: 1 } }] })).toHaveLength(1)
    expect(stepIssues('abilities', { ...d, baseAbilities: { ...d.baseAbilities, str: 18 }, improvements })).toEqual(["An Ability Score Improvement can't raise STR above 20."])
  })
})
