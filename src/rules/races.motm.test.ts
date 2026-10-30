import { describe, expect, it } from 'vitest'
import { stepIssues } from '../builder/validate'
import { explainKey } from '../builder/why'
import { he } from '../i18n/locales/he'
import type { Character } from '../model/character'
import { MOTM_RACES } from './data/books/races.motm'
import { allRaces, createCharacter, derive, getAbilityScores, getFeats, raceProfile, raceUseId, type CharacterDraft } from './index'

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: 'tortle', backgroundId: 'acolyte', classes: [{ classId: 'fighter', level: 1 }],
  abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  freeAbilityBonuses: ['str', 'str', 'con'], chosenSkills: ['athletics', 'perception'], chosenLanguages: ['Elvish'],
  chosenTools: [], traitChoices: {},
  ...over,
})
const make = (over: Partial<CharacterDraft> = {}): Character => ({ ...createCharacter(draft(over)), inventory: [] })

describe('Monsters of the Multiverse, Witchlight, Strixhaven and Tasha races', () => {
  it('offers every race from the audit with 2014 rules only', () => {
    const ids = allRaces('2014').map(r => r.id)
    for (const id of ['aasimar', 'bugbear', 'centaur', 'changeling', 'fairy', 'firbolg', 'genasi', 'githyanki', 'githzerai', 'goblin',
      'goliath', 'harengon', 'hobgoblin', 'kenku', 'kobold', 'lizardfolk', 'minotaur', 'orc', 'satyr', 'tabaxi', 'tortle', 'triton',
      'yuan-ti', 'aarakocra', 'owlin', 'custom-lineage']) expect(ids, id).toContain(id)
    expect(allRaces('2024').find(r => r.id === 'tabaxi')?.legacy).toBe(true)
    expect(MOTM_RACES.every(r => r.source)).toBe(true)
  })

  it('gives +2/+1 or +1/+1/+1 where the player wants', () => {
    const c = make({ raceId: 'goblin', freeAbilityBonuses: ['dex', 'dex', 'con'] })
    const s = getAbilityScores(c)
    expect([s.dex, s.con, s.str]).toEqual([16, 14, 15])
  })

  it('applies natural armor, natural weapons and swim speed (Lizardfolk, Tortle)', () => {
    const liz = derive(make({ raceId: 'lizardfolk', traitChoices: { naturesIntuition: 'nature,stealth' } }))
    expect(liz.armorClass.value).toBe(13 + 2)
    expect(liz.attacks.find(a => a.name === 'Bite')?.damage).toBe('1d6+3')
    expect(liz.skills.nature.proficient).toBe(true)
    expect(liz.skills.stealth.proficient).toBe(true)
    expect(liz.speeds.swim).toBe(30)
    const tortle = derive(make({ traitChoices: { naturesIntuition: 'survival' } }))
    expect(tortle.armorClass.value).toBe(17)
  })

  it('unlocks innate spells and uses by character level (Githyanki, Aasimar)', () => {
    const low = derive(make({ raceId: 'githyanki' }))
    expect(low.itemSpells.map(s => s.spell)).toEqual(['Mage Hand'])
    expect(low.defenses.resistances).toContain('psychic')
    const high = derive(make({ raceId: 'githyanki', classes: [{ classId: 'fighter', level: 5 }] }))
    expect(high.itemSpells.map(s => s.spell)).toEqual(['Mage Hand', 'Jump', 'Misty Step'])
    const aasimar = (level: number) => derive(make({ raceId: 'aasimar', classes: [{ classId: 'fighter', level }] })).resources.map(r => r.id)
    expect(aasimar(1)).toContain(raceUseId('Healing Hands'))
    expect(aasimar(1)).not.toContain(raceUseId('Celestial Revelation'))
    expect(aasimar(3)).toContain(raceUseId('Celestial Revelation'))
  })

  it('applies genasi lineages and proficiency-bonus uses', () => {
    const fire = derive(make({ raceId: 'genasi', subraceId: 'fire-genasi' }))
    expect(fire.senses.darkvision).toBe(60)
    expect(fire.defenses.resistances).toContain('fire')
    expect(raceProfile({ raceId: 'genasi', subraceId: 'air-genasi' }).speed).toBe(35)
    const goliath = derive(make({ raceId: 'goliath', classes: [{ classId: 'fighter', level: 5 }] }))
    expect(goliath.resources.find(r => r.id === raceUseId("Stone's Endurance"))?.max).toBe(3)
  })

  it('adds the proficiency bonus to Harengon initiative', () => {
    expect(derive(make({ raceId: 'harengon' })).initiative).toBe(2 + 2)
  })

  it('builds a Custom Lineage: +2 to one ability, a feat, darkvision or a skill', () => {
    const c = make({ raceId: 'custom-lineage', freeAbilityBonuses: ['str'], originFeatId: 'grappler', traitChoices: { variableTrait: 'darkvision' } })
    expect(getAbilityScores(c).str).toBe(17)
    expect(getFeats(c).map(f => f.id)).toContain('grappler')
    expect(derive(c).senses.darkvision).toBe(60)
    expect(stepIssues('race', draft({ raceId: 'custom-lineage' })).length).toBeGreaterThan(0)
    expect(stepIssues('race', draft({ raceId: 'custom-lineage', originFeatId: 'grappler', traitChoices: { variableTrait: 'arcana' } }))).toEqual([])
  })

  it('asks for every pick (Changeling Instincts takes two)', () => {
    expect(stepIssues('race', draft({ raceId: 'changeling', traitChoices: { changelingInstincts: 'insight' } })).length).toBe(1)
    expect(stepIssues('race', draft({ raceId: 'changeling', traitChoices: { changelingInstincts: 'insight,deception' } }))).toEqual([])
  })

  it('explains every race, lineage and trait in English and names them in Hebrew', () => {
    const traitKey = (raceId: string, name: string) => explainKey('trait', `${raceId}.${name}`) ?? explainKey('trait', name)
    const missing = MOTM_RACES.flatMap(r => [
      ...(explainKey('race', r.id) ? [] : [r.id]),
      ...(r.subraces ?? []).filter(s => !explainKey('sub2014', s.id)).map(s => s.id),
      ...[...r.traits, ...(r.subraces ?? []).flatMap(s => s.traits), ...(r.choices ?? []).map(ch => ch.name)]
        .filter(t => !traitKey(r.id, t)).map(t => `${r.id}: ${t}`),
    ])
    expect(missing).toEqual([])
    const names = MOTM_RACES.flatMap(r => [`race.${r.id}`, ...(r.subraces ?? []).map(s => `race.${s.id}`), ...r.traits.map(t => `trait.${t}`)])
    expect(names.filter(k => !(k in he.terms))).toEqual([])
  })
})
