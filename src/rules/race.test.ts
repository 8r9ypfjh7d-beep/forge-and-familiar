import { afterEach, describe, expect, it } from 'vitest'
import { stepIssues } from '../builder/validate'
import { explain } from '../explain/math'
import type { Character } from '../model/character'
import {
  createCharacter, derive, getAbilityScores, getLanguages, getTools, raceProfile, raceUseId, racialBonuses, registerHomebrewRaces,
  type CharacterDraft, type Race, type Subrace,
} from './index'

// A made-up race that uses every race rule, registered like homebrew.
const TEST: Race = {
  id: 'hb:t:testfolk', name: 'Testfolk', size: 'Medium', sizeOptions: ['Medium', 'Small'], speed: 30,
  abilityBonuses: {}, flexibleAbilityBonuses: true, languages: ['Common'], languageChoices: 1,
  traits: ['Darkvision', 'Shell', 'Tough Hide', 'Gift'], subraceOptional: true,
  tools: ["Tinker's tools"], weaponIds: ['rapier'], armor: ['light'],
  naturalArmor: { base: 13, dex: true },
  effects: [
    { kind: 'sense', sense: 'darkvision', value: 60 },
    { kind: 'resistance', damage: 'poison' },
    { kind: 'spell', spell: 'Misty Step', note: 'once per long rest', level: 3 },
  ],
  uses: [{ trait: 'Gift', count: 'pb', recharge: 'long' }, { trait: 'Late Gift', count: 1, recharge: 'short', level: 5 }],
  choices: [
    { id: 'hide', name: 'Tough Hide', options: [{ id: 'swim', name: 'Fins', effects: [{ kind: 'moveSpeed', mode: 'swim', value: 0 }] }, { id: 'climb', name: 'Claws', effects: [{ kind: 'moveSpeed', mode: 'climb', value: 0 }] }] },
    { id: 'knack', name: 'Knack', count: 2, options: ['insight', 'deception', 'persuasion'].map(s => ({ id: s, name: s, effects: [{ kind: 'skillProficiency' as const, skill: s as 'insight' }] })) },
  ],
}
const MARKED: Subrace = {
  id: 'hb:t:marked', name: 'Marked', parentRaceId: TEST.id, abilityBonuses: { int: 2 }, replacesBonuses: true,
  freeAbilityBonuses: { count: 1, exclude: ['int'] }, removesTraits: ['Shell'], traits: ['Mark'], featChoice: true,
  skillProficiencies: ['arcana'], freeSkillChoices: 0, languages: ['Draconic'],
}

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: TEST.id, backgroundId: 'acolyte', classes: [{ classId: 'fighter', level: 1 }],
  abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  freeAbilityBonuses: ['str', 'str', 'con'], chosenSkills: ['athletics', 'perception'], chosenLanguages: ['Elvish'],
  traitChoices: { hide: 'swim', knack: 'insight,deception' },
  ...over,
})
const make = (over: Partial<CharacterDraft> = {}): Character => createCharacter(draft(over))

describe('race rules', () => {
  registerHomebrewRaces([TEST], [MARKED])
  afterEach(() => registerHomebrewRaces([TEST], [MARKED]))

  it('applies flexible +2/+1 bonuses, at most +2 to one ability', () => {
    expect(racialBonuses(draft())).toMatchObject({ str: 2, con: 1, dex: 0 })
    expect(racialBonuses(draft({ freeAbilityBonuses: ['str', 'str', 'str'] }))).toMatchObject({ str: 2 })
    expect(getAbilityScores(make()).str).toBe(17)
    expect(stepIssues('abilities', draft({ freeAbilityBonuses: ['str'] }))).toContain('Give your racial bonuses: +2 and +1, or +1 to three abilities.')
  })

  it('puts senses, resistances, picked options and level-gated spells on the sheet', () => {
    const d = derive(make())
    expect(d.senses.darkvision).toBe(60)
    expect(d.defenses.resistances).toContain('poison')
    expect(d.speeds.swim).toBe(30)
    expect(d.speeds.climb).toBeUndefined()
    expect(d.skills.insight.proficient && d.skills.deception.proficient).toBe(true)
    expect(d.itemSpells).toEqual([])
    expect(derive(make({ classes: [{ classId: 'fighter', level: 3 }] })).itemSpells[0]).toMatchObject({ spell: 'Misty Step', source: 'Testfolk' })
  })

  it('tracks limited-use traits from their level', () => {
    expect(derive(make()).resources.find(r => r.id === raceUseId('Gift'))).toMatchObject({ max: 2, recharge: 'long' })
    expect(derive(make()).resources.some(r => r.id === raceUseId('Late Gift'))).toBe(false)
    expect(derive(make({ classes: [{ classId: 'fighter', level: 5 }] })).resources.find(r => r.id === raceUseId('Gift'))?.max).toBe(3)
  })

  it('uses natural armor when better, with a shield on top, and shows the same math', () => {
    const c = make({ classes: [{ classId: 'wizard', level: 1 }] })
    expect(derive(c).armorClass).toMatchObject({ value: 15, source: 'Natural Armor' })
    expect(explain(c, 'ac')?.total).toBe(15)
  })

  it('knows its tools, languages, weapons and size pick', () => {
    const c = make({ sizeChoice: 'Small' })
    expect(getTools(c)).toContain("Tinker's tools")
    expect(getLanguages(c)).toEqual(expect.arrayContaining(['Common', 'Elvish']))
    expect(derive(c).size).toBe('Small')
    expect(derive(make()).size).toBe('Medium')
  })

  it('lets a subrace replace scores, swap traits and grant a feat', () => {
    const d = draft({ subraceId: MARKED.id, freeAbilityBonuses: ['dex'], originFeatId: 'grappler' })
    expect(racialBonuses(d)).toMatchObject({ int: 2, dex: 1, str: 0 })
    const p = raceProfile(d)
    expect(p.traits).toEqual(['Darkvision', 'Tough Hide', 'Gift', 'Mark'])
    expect(p.featChoice).toBe('any')
    expect(p.skillProficiencies).toEqual(['arcana'])
    expect(p.languages).toEqual(['Common', 'Draconic'])
    expect(stepIssues('race', d)).toEqual([])
    expect(stepIssues('race', { ...d, originFeatId: undefined })).toContain('Pick a feat for your race.')
  })

  it('asks for every trait pick, and allows no subrace when optional', () => {
    expect(stepIssues('race', draft())).toEqual([])
    expect(stepIssues('race', draft({ traitChoices: { hide: 'swim', knack: 'insight' } }))).toHaveLength(1)
  })
})
