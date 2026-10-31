import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import {
  BOOK_FEATS, BOOK_FEATS_2024, CUSTOM_FEAT, FEATS, FEATS_2024, allFeats, createCharacter, derive, featById, getMaxHp, getProficiencies,
  getResources, unmetFeatPrereqs, type CharacterDraft,
} from './index'

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'fighter', level: 4 }],
  abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  freeAbilityBonuses: [], chosenSkills: ['athletics', 'perception'],
  ...over,
})
const withFeat = (featId: string, over: Partial<CharacterDraft> = {}, extra: object = {}): Character =>
  createCharacter(draft({ improvements: [{ classId: 'fighter', level: 4, featId, ...extra }], ...over }))

describe('official feats', () => {
  it('lists every book feat once per edition, with unique ids', () => {
    for (const list of [allFeats('2014'), allFeats('2024')]) expect(new Set(list.map(f => f.id)).size).toBe(list.length)
    expect(allFeats('2014').length).toBeGreaterThan(100)
    expect(allFeats('2024').length).toBeGreaterThan(130)
    expect(allFeats('2024').filter(f => f.category === 'epic-boon')).toHaveLength(12)
    expect(allFeats('2024').filter(f => f.category === 'fighting-style')).toHaveLength(10)
    expect(allFeats('2024').filter(f => f.category === 'origin').map(f => f.id)).toEqual(expect.arrayContaining([
      'alert', 'crafter', 'healer', 'lucky', 'magic-initiate', 'musician', 'savage-attacker', 'skilled', 'tavern-brawler', 'tough',
      'harper-agent', 'mark-of-making', 'aberrant-dragonmark',
    ]))
  })

  it('keeps the 2014 and 2024 versions apart', () => {
    expect(featById('lucky')?.uses?.count).toBe(3)
    expect(featById('lucky', '2024')?.uses?.count).toBe('pb')
    expect(featById('boon-of-fate')).toBeUndefined()
    // Older book feats can be taken under 2024 rules as level 4+ general feats.
    expect(featById('elven-accuracy', '2024')?.category).toBe('racial')
    expect(featById('gunner', '2024')).toMatchObject({ category: 'general', minLevel: 4 })
    expect(featById('fey-touched', '2024')?.source).toBe("Player's Handbook (2024)")
  })

  it('gives every book feat a source; SRD feats have none', () => {
    expect([...BOOK_FEATS, ...BOOK_FEATS_2024].filter(f => !f.source)).toEqual([])
    expect([...FEATS, ...FEATS_2024].filter(f => f.source)).toEqual([])
  })
})

describe('feat effects on the sheet', () => {
  it('Tough adds HP per level and Mobile adds speed', () => {
    expect(getMaxHp(withFeat('tough'))).toBe(getMaxHp(createCharacter(draft())) + 8)
    expect(derive(withFeat('mobile')).speed).toBe(40)
  })

  it('Resilient raises the picked ability and adds its save', () => {
    const d = derive(withFeat('resilient', {}, { featAbility: 'wis' }))
    expect(d.abilities.wis).toBe(12) // 10 + human 1 + feat 1
    expect(d.saves.wis.proficient).toBe(true)
  })

  it('applies resistances, spells, senses and training', () => {
    const tiefling = derive(withFeat('infernal-constitution', { raceId: 'tiefling' }))
    expect(tiefling.defenses.resistances).toEqual(expect.arrayContaining(['cold', 'poison']))
    expect(derive(withFeat('fey-touched', {}, { featAbility: 'int' })).itemSpells.map(s => s.spell)).toContain('Misty Step')
    const wizard = { classes: [{ classId: 'wizard', level: 4 }] }
    const armored = createCharacter(draft({ ...wizard, improvements: [{ classId: 'wizard', level: 4, featId: 'lightly-armored', featAbility: 'dex' }] }))
    expect(getProficiencies(armored).armor.has('light')).toBe(true)
    const skulker = createCharacter(draft({ rulesEdition: '2024', backgroundId: 'soldier', improvements: [{ classId: 'fighter', level: 4, featId: 'skulker', featAbility: 'dex' }] }))
    expect(derive(skulker).senses.blindsight).toBe(10)
  })

  it('tracks feat uses on Resources', () => {
    expect(getResources(withFeat('lucky')).find(r => r.id === 'feat:lucky')).toMatchObject({ max: 3, recharge: 'long' })
    expect(getResources(withFeat('chef', {}, { featAbility: 'con' })).find(r => r.id === 'feat:chef')).toMatchObject({ label: 'Treats', max: 2 })
  })
})

describe('custom feats', () => {
  it('applies everything the player built', () => {
    const c = withFeat(CUSTOM_FEAT, {}, {
      featAbility: 'cha',
      customFeat: {
        id: 'custom', name: 'Moon Blessing', description: 'A gift of the moon.',
        effects: [{ kind: 'abilityChoice', from: ['wis', 'cha'], max: 20, save: true }, { kind: 'speed', amount: 5 }],
        stats: [{ kind: 'resistance', damage: 'radiant' }, { kind: 'sense', sense: 'darkvision', value: 60 }],
        uses: { count: 'pb', recharge: 'short', label: 'Moonbeams' },
        armor: ['heavy'],
      },
    })
    const d = derive(c)
    expect(d.feats).toEqual(['Moon Blessing'])
    expect(d.abilities.cha).toBe(10) // 8 + human 1 + feat 1
    expect(d.saves.cha.proficient).toBe(true)
    expect(d.speed).toBe(35)
    expect(d.defenses.resistances).toContain('radiant')
    expect(d.senses.darkvision).toBe(60)
    expect(getResources(c).find(r => r.label === 'Moonbeams')).toMatchObject({ max: 2, recharge: 'short' })
    expect(getProficiencies(c).armor.has('heavy')).toBe(true)
  })

  it('works as a 2024 Human\'s Origin feat', () => {
    const c = createCharacter(draft({
      rulesEdition: '2024', backgroundId: 'soldier', classes: [{ classId: 'fighter', level: 1 }], originFeatId: CUSTOM_FEAT,
      customOriginFeat: { id: 'custom', name: 'Street Smarts', description: '', effects: [{ kind: 'initiative', amount: 2 }] },
    }))
    expect(derive(c).feats).toContain('Street Smarts')
  })
})

describe('feat prerequisites', () => {
  it('reports what is missing, never blocks', () => {
    const wizard = draft({ classes: [{ classId: 'wizard', level: 4 }] })
    expect(unmetFeatPrereqs(wizard, featById('heavy-armor-master')!, 4)).toEqual([{ kind: 'armor', armor: 'heavy' }])
    expect(unmetFeatPrereqs(draft(), featById('heavy-armor-master')!, 4)).toEqual([])
    expect(unmetFeatPrereqs(draft(), featById('war-caster')!, 4)).toEqual([{ kind: 'spellcasting' }])
    expect(unmetFeatPrereqs(wizard, featById('war-caster')!, 4)).toEqual([])
    expect(unmetFeatPrereqs(draft(), featById('elven-accuracy')!, 4)).toEqual([{ kind: 'race', races: ['elf', 'half-elf'] }])
    expect(unmetFeatPrereqs(draft(), featById('inspiring-leader')!, 4)).toEqual([{ kind: 'ability', abilities: { cha: 13 } }])
    expect(unmetFeatPrereqs(draft(), featById('vigor-of-the-hill-giant')!, 4)).toEqual([{ kind: 'feat', feats: ['strike-of-the-giants'] }])
    const d24 = draft({ rulesEdition: '2024', backgroundId: 'soldier' })
    expect(unmetFeatPrereqs(d24, featById('boon-of-fate', '2024')!, 4)).toEqual([{ kind: 'level', level: 19 }])
    expect(unmetFeatPrereqs({ ...d24, classes: [{ classId: 'wizard', level: 4 }] }, featById('dueling', '2024')!, 4)).toEqual([{ kind: 'feature', feature: 'Fighting Style' }])
    expect(unmetFeatPrereqs(d24, featById('dueling', '2024')!, 4)).toEqual([])
  })
})
