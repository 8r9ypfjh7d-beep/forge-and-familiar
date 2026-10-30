import { describe, expect, it } from 'vitest'
import { emptyDraft } from './Builder'
import { stepIssues, stepWarnings } from './validate'
import { createCharacter, derive } from '../rules'

const base = () => ({ ...emptyDraft('u1'), backgroundId: 'acolyte', raceId: 'half-elf', classes: [{ classId: 'rogue', level: 1 }], chosenLanguages: ['Dwarvish', 'Giant', 'Orc'] })

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

  it('asks to roll, then to use each rolled score once', () => {
    const d = { ...base(), abilityMethod: 'rolled' as const, freeAbilityBonuses: ['dex' as const, 'con' as const] }
    expect(stepIssues('abilities', d)).toEqual(['Roll your six scores first.'])
    const rolled = { ...d, rolledScores: [17, 13, 13, 11, 9, 6] }
    expect(stepIssues('abilities', { ...rolled, baseAbilities: { str: 17, dex: 13, con: 13, int: 11, wis: 9, cha: 0 } })).toEqual(['Assign each rolled score to one ability.'])
    expect(stepIssues('abilities', { ...rolled, baseAbilities: { str: 17, dex: 13, con: 13, int: 11, wis: 9, cha: 6 } })).toEqual([])
  })

  it('counts class and free race skill picks', () => {
    // Rogue picks 4 from its list, half-elf adds 2 of any kind; acolyte grants insight + religion.
    const picks = ['stealth', 'acrobatics', 'deception', 'perception', 'arcana', 'history'] as const
    expect(stepIssues('skills', { ...base(), chosenSkills: [...picks], classPicks: { 'rogue.expertise': ['stealth', 'acrobatics'] } })).toEqual([])
    expect(stepIssues('skills', { ...base(), chosenSkills: [...picks] })).toEqual(['Rogue: pick 2 for Expertise.'])
    const expertise = { 'rogue.expertise': ['stealth', 'acrobatics'] }
    expect(stepIssues('skills', { ...base(), classPicks: expertise, chosenSkills: [...picks.slice(0, 5)] })).toHaveLength(1)
    expect(stepIssues('skills', { ...base(), classPicks: expertise, chosenSkills: [...picks.slice(0, 5), 'insight'] })).toHaveLength(1)
  })

  it('only warns, never blocks, when a multiclass prerequisite is missing', () => {
    const d = { ...base(), raceId: 'human', classes: [{ classId: 'rogue', level: 3 }, { classId: 'wizard', level: 2 }], abilityMethod: 'manual' as const }
    const scores = { str: 8, dex: 14, con: 12, int: 11, wis: 10, cha: 10 }
    expect(stepIssues('abilities', { ...d, baseAbilities: scores })).toEqual([])
    expect(derive(createCharacter({ ...d, baseAbilities: scores })).warnings).toContain('Multiclass prerequisite not met: Wizard needs INT 13.')
  })

  it('asks for language picks from race and background', () => {
    const picks = ['stealth', 'acrobatics', 'deception', 'perception', 'arcana', 'history'] as const
    const d = { ...base(), chosenSkills: [...picks], classPicks: { 'rogue.expertise': ['stealth', 'acrobatics'] } }
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
    // A tool off a pick's usual list fills it and only warns.
    const swapped = { ...d, chosenTools: ['Lute', "Mason's tools", 'Drum', 'Viol'] }
    expect(stepIssues('skills', swapped)).toEqual([])
    expect(stepWarnings('skills', swapped)).toEqual(['Some tools are not on the usual list. Fine if your DM agrees.'])
    expect(stepWarnings('skills', { ...d, chosenTools: ["Mason's tools", 'Lute', 'Drum', 'Viol'] })).toEqual([])
  })

  it('lets skills come from outside the class list with a warning', () => {
    const d = { ...base(), raceId: 'dwarf', subraceId: 'hill-dwarf', classes: [{ classId: 'fighter', level: 1 }], chosenLanguages: ['Elvish', 'Giant'], chosenTools: ["Mason's tools"] }
    const offList = { ...d, chosenSkills: ['athletics', 'arcana'] as ('athletics' | 'arcana')[] }
    expect(stepIssues('skills', offList)).toEqual([])
    expect(stepWarnings('skills', offList)).toEqual(['Some skills are not on your class or background list. Fine if your DM agrees.'])
    expect(stepWarnings('skills', { ...d, chosenSkills: ['athletics', 'perception'] })).toEqual([])
    expect(stepIssues('skills', { ...d, chosenSkills: ['athletics'] })).toHaveLength(1)
  })

  it('warns, never blocks, for off-book ability choices', () => {
    const he = { ...base(), baseAbilities: { str: 8, dex: 15, con: 14, int: 12, wis: 10, cha: 13 }, freeAbilityBonuses: ['cha', 'dex'] as ('cha' | 'dex')[] }
    expect(stepIssues('abilities', he)).toEqual([])
    expect(stepWarnings('abilities', he)).toEqual(["A Half-Elf doesn't usually take a +1 in CHA. Fine if your DM agrees."])
    const dwarf = { ...base(), raceId: 'dwarf', subraceId: 'hill-dwarf', baseAbilities: he.baseAbilities, freeAbilityBonuses: [], racialBonusTargets: ['dex' as const] }
    expect(stepIssues('abilities', dwarf)).toEqual([])
    expect(stepWarnings('abilities', dwarf)).toEqual(['You moved your racial bonuses. Many tables allow it; check with your DM.'])
  })

  it('takes any official or written-in language, and warns for another class\'s secret language', () => {
    const skills = { ...base(), chosenSkills: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation'] as const }
    const d = { ...skills, chosenSkills: [...skills.chosenSkills], chosenLanguages: ['Elderspeak', 'Chondathan', 'Druidic'] }
    expect(stepIssues('skills', d).filter(m => m.includes('language'))).toEqual([])
    expect(stepWarnings('skills', d)).toContain('Druidic is normally taught only by its class (Druid or Rogue). Fine if your DM agrees.')
    expect(stepWarnings('skills', { ...d, chosenLanguages: ['Elderspeak', 'Chondathan', 'Gith'] })).toEqual([])
  })

  it('requires a subclass at the right level and dragonborn ancestry', () => {
    expect(stepIssues('class', { ...base(), classes: [{ classId: 'rogue', level: 2 }] })).toEqual([])
    expect(stepIssues('class', { ...base(), classes: [{ classId: 'rogue', level: 3 }] })).toEqual(['Choose the Roguish Archetype for your Rogue.'])
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
    const capped = { ...d, baseAbilities: { ...d.baseAbilities, str: 18 }, improvements }
    expect(stepIssues('abilities', capped)).toEqual([])
    expect(stepWarnings('abilities', capped)).toEqual(['Scores stop at 20, so part of your STR increase is lost.'])
  })

  it("warns, never blocks, when racial proficiencies are swapped (Tasha's)", () => {
    const d = { ...base(), raceId: 'half-orc' }
    expect(stepWarnings('race', d)).toEqual([])
    const swapped = { ...d, originSwaps: { skills: { intimidation: 'persuasion' as const } } }
    expect(stepIssues('race', swapped)).toEqual([])
    expect(stepWarnings('race', swapped)).toHaveLength(1)
    expect(stepWarnings('race', { ...d, originSwaps: {} })).toEqual([])
  })
})
