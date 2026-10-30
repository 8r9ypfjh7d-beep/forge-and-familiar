import { describe, expect, it } from 'vitest'
import { stepIssues } from '../builder/validate'
import { BOOK_RACES, BOOK_SUBRACES, createCharacter, derive, getAbilityScores, getFeats, getResources, raceById, raceProfile, type CharacterDraft } from './index'

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'fighter', level: 1 }],
  abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  freeAbilityBonuses: [], chosenSkills: ['athletics', 'perception'],
  ...over,
})
const at = (level: number, over: Partial<CharacterDraft>) => derive(createCharacter(draft({ ...over, classes: [{ classId: 'fighter', level }] })))
const spells = (d: ReturnType<typeof derive>) => d.itemSpells.map(s => s.spell)

describe('2014 book subraces and variants', () => {
  it('attaches every book subrace to its race', () => {
    for (const s of BOOK_SUBRACES['2014']) expect(raceById(s.parentRaceId!)?.subraces?.some(x => x.id === s.id), s.id).toBe(true)
    expect(BOOK_RACES['2014'].map(r => r.id)).toEqual(expect.arrayContaining(['chromatic-dragonborn', 'metallic-dragonborn', 'gem-dragonborn', 'astral-elf']))
  })

  it('lets Human, Half-Elf, Tiefling and Dragonborn skip the subrace', () => {
    expect(stepIssues('race', draft())).toEqual([])
    expect(stepIssues('race', draft({ raceId: 'tiefling' }))).toEqual([])
    expect(stepIssues('race', draft({ raceId: 'dwarf' }))).not.toEqual([])
  })

  it('gives Variant Human two +1s, a skill and any feat instead of +1 to everything', () => {
    const d = draft({ subraceId: 'variant-human', freeAbilityBonuses: ['str', 'con'], originFeatId: 'grappler' })
    expect(getAbilityScores(d)).toMatchObject({ str: 16, dex: 14, con: 14, int: 12 })
    expect(raceProfile(d)).toMatchObject({ freeSkillChoices: 1, featChoice: 'any' })
    expect(getFeats(d).map(f => f.id)).toContain('grappler')
  })

  it('applies drow darkvision, weapons and level-gated spells', () => {
    const one = at(1, { raceId: 'elf', subraceId: 'drow' })
    expect(one.senses.darkvision).toBe(120)
    expect(one.abilities.cha).toBe(9)
    expect(spells(one)).toEqual(['Dancing Lights'])
    expect(spells(at(5, { raceId: 'elf', subraceId: 'drow' }))).toEqual(['Dancing Lights', 'Faerie Fire', 'Darkness'])
    expect(raceProfile(draft({ raceId: 'elf', subraceId: 'drow' })).weaponIds).toContain('hand-crossbow')
  })

  it('gives SRD races their trait rules', () => {
    const dwarf = at(1, { raceId: 'dwarf', subraceId: 'hill-dwarf' })
    expect(dwarf.senses.darkvision).toBe(60)
    expect(dwarf.defenses.resistances).toContain('poison')
    const tief = at(5, { raceId: 'tiefling' })
    expect(tief.defenses.resistances).toEqual(['fire'])
    expect(spells(tief)).toEqual(['Thaumaturgy', 'Hellish Rebuke (as 2nd level)', 'Darkness'])
    expect(at(1, { raceId: 'dragonborn', traitChoices: { draconicAncestry: 'red' } }).defenses.resistances).toEqual(['fire'])
  })

  it('swaps out traits a variant replaces', () => {
    const glasya = at(5, { raceId: 'tiefling', subraceId: 'tiefling-glasya' })
    expect(glasya.abilities).toMatchObject({ dex: 15, int: 12, cha: 10 })
    expect(spells(glasya)).toEqual(['Minor Illusion', 'Disguise Self (as 2nd level)', 'Invisibility'])
    expect(glasya.traits).not.toContain('Infernal Legacy')
    const winged = at(1, { raceId: 'tiefling', subraceId: 'tiefling-feral-winged' })
    expect(winged.speeds.fly).toBe(30)
    expect(winged.abilities).toMatchObject({ dex: 16, int: 13, cha: 8 })
    const blood = at(1, { raceId: 'dragonborn', subraceId: 'draconblood', traitChoices: { draconicAncestry: 'red' } })
    expect(blood.defenses.resistances).toEqual([])
    expect(blood.abilities).toMatchObject({ str: 15, int: 14, cha: 9 })
    expect(raceProfile(draft({ raceId: 'half-elf', subraceId: 'half-elf-wood-fleet' }))).toMatchObject({ freeSkillChoices: 0, speed: 35 })
  })

  it('applies subrace proficiencies, speeds and resources', () => {
    expect(raceProfile(draft({ raceId: 'dwarf', subraceId: 'mountain-dwarf' })).armor).toEqual(['light', 'medium'])
    expect(at(1, { raceId: 'elf', subraceId: 'sea-elf' }).speeds.swim).toBe(30)
    expect(at(1, { raceId: 'elf', subraceId: 'wood-elf' }).speed).toBe(35)
    expect(at(1, { raceId: 'halfling', subraceId: 'stout' }).defenses.resistances).toContain('poison')
    expect(at(1, { raceId: 'elf', subraceId: 'shadar-kai' }).defenses.resistances).toContain('necrotic')
    const c = createCharacter(draft({ raceId: 'elf', subraceId: 'eladrin' }))
    expect(getResources(c).find(r => r.id === 'race:fey-step')).toMatchObject({ max: 1, recharge: 'short' })
  })

  it("gives Fizban's dragonborn flexible bonuses and ancestry resistance", () => {
    const d = draft({ raceId: 'gem-dragonborn', freeAbilityBonuses: ['str', 'str', 'con'], traitChoices: { draconicAncestry: 'amethyst' } })
    expect(getAbilityScores(d)).toMatchObject({ str: 17, con: 14 })
    const sheet = derive(createCharacter({ ...d, classes: [{ classId: 'fighter', level: 5 }] }))
    expect(sheet.defenses.resistances).toEqual(['force'])
    expect(getResources(createCharacter({ ...d, classes: [{ classId: 'fighter', level: 5 }] })).find(r => r.id === 'race:breath-weapon-fizban')?.max).toBe(3)
  })
})
