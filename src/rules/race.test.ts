import { afterEach, describe, expect, it } from 'vitest'
import { stepIssues } from '../builder/validate'
import { explain } from '../explain/math'
import type { Character } from '../model/character'
import { explainKey } from '../builder/why'
import { SETTING_RACES, SETTING_SUBRACES } from './data/books/races.settings'
import { he } from '../i18n/locales/he'
import {
  allRaces, createCharacter, derive, getAbilityScores, getLanguages, getTools, raceById, raceProfile, raceUseId, racialBonuses,
  registerHomebrewRaces, type CharacterDraft, type Race, type Subrace,
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

describe('setting races (Eberron, Ravnica, Theros, Spelljammer, Ravenloft and more)', () => {
  const book = (over: Partial<CharacterDraft>) => draft({ freeAbilityBonuses: [], traitChoices: {}, chosenLanguages: [], ...over })
  const all = SETTING_RACES
  const subs = SETTING_SUBRACES

  it('are offered in 2014 with their dragonmarks attached', () => {
    const ids = allRaces('2014').map(r => r.id)
    for (const id of ['warforged', 'kalashtar', 'loxodon', 'leonin', 'autognome', 'thri-kreen', 'dhampir', 'hexblood', 'kender', 'grung']) expect(ids).toContain(id)
    expect(raceById('human')?.subraceOptional).toBe(true)
    expect(raceById('human')?.subraces?.map(s => s.id)).toContain('mark-of-making')
    expect(raceById('halfling')?.subraces?.map(s => s.id)).toEqual(expect.arrayContaining(['lightfoot', 'mark-of-healing', 'mark-of-hospitality']))
  })

  it('explains every race, subrace and trait in English and Hebrew', () => {
    const traits = new Set([...all, ...subs, ...all.flatMap(r => r.subraces ?? [])].flatMap(r => [...r.traits, ...(r.choices ?? []).map(c => c.name)]))
    expect(all.filter(r => !explainKey('race', r.id)).map(r => r.id)).toEqual([])
    expect([...subs, ...all.flatMap(r => r.subraces ?? [])].filter(s => !explainKey('sub2014', s.id)).map(s => s.id)).toEqual([])
    expect([...traits].filter(t => !explainKey('trait', t))).toEqual([])
    const names = [...all, ...subs, ...all.flatMap(r => r.subraces ?? [])].map(r => `race.${r.id}`)
    expect([...names, ...[...traits].map(t => `trait.${t}`)].filter(k => !(k in he.terms))).toEqual([])
  })

  it('applies traits on the sheet', () => {
    const warforged = derive(make(book({ raceId: 'warforged', freeAbilityBonuses: ['str'], classes: [{ classId: 'wizard', level: 1 }] })))
    expect(warforged.armorClass.value).toBe(10 + 2 + 1)
    expect(warforged.defenses.resistances).toContain('poison')
    const loxodon = make(book({ raceId: 'loxodon', classes: [{ classId: 'wizard', level: 1 }] }))
    expect(derive(loxodon).armorClass).toMatchObject({ value: 12 + 2, source: 'Natural Armor' })
    expect(explain(loxodon, 'ac')?.total).toBe(14)
    expect(derive(make(book({ raceId: 'dhampir', freeAbilityBonuses: ['dex', 'dex', 'con'] }))).speeds.climb).toBe(35)
    expect(derive(make(book({ raceId: 'hexblood', freeAbilityBonuses: ['cha', 'cha', 'con'] }))).itemSpells.map(s => s.spell)).toEqual(['Disguise Self', 'Hex'])
    expect(derive(make(book({ raceId: 'vedalken' }))).saves.int.advantage).toBe(true)
    expect(derive(make(book({ raceId: 'kender', freeAbilityBonuses: ['dex', 'dex', 'cha'], traitChoices: { kenderAptitude: 'stealth' } }))).skills.stealth.proficient).toBe(true)
    expect(derive(make(book({ raceId: 'leonin' }))).attacks.some(a => a.name === 'Claws')).toBe(true)
    expect(derive(make(book({ raceId: 'leonin' }))).resources.find(r => r.id === raceUseId('Daunting Roar'))).toMatchObject({ max: 1, recharge: 'short' })
  })

  it('handles dragonmarks that replace the race scores and traits', () => {
    const making = book({ raceId: 'human', subraceId: 'mark-of-making', freeAbilityBonuses: ['dex'] })
    expect(racialBonuses(making)).toMatchObject({ int: 2, dex: 1, str: 0, cha: 0 })
    expect(derive(make(making)).itemSpells.map(s => s.spell)).toEqual(['Mending', 'Magic Weapon'])
    const finding = raceProfile(book({ raceId: 'half-orc', subraceId: 'mark-of-finding' }))
    expect(finding.traits).not.toContain('Menacing')
    expect(finding.skillProficiencies).toEqual([])
    expect(raceProfile(book({ raceId: 'half-elf', subraceId: 'mark-of-storm' })).freeSkillChoices).toBe(0)
    expect(stepIssues('race', book({ raceId: 'human' }))).toEqual([])
  })

  it('opens Simic Hybrid\'s second enhancement at 5th level', () => {
    const d = book({ raceId: 'simic-hybrid', traitChoices: { enhancement1: 'nimble-climber' } })
    expect(stepIssues('race', d)).toEqual([])
    expect(derive(make(d)).speeds.climb).toBe(30)
    const five = { ...d, classes: [{ classId: 'fighter', level: 5 }] }
    expect(stepIssues('race', five)).toHaveLength(1)
    expect(derive(make({ ...five, traitChoices: { enhancement1: 'nimble-climber', enhancement5: 'carapace' } })).armorClass.value).toBe(derive(make(five)).armorClass.value + 1)
  })
})
