import { describe, expect, it } from 'vitest'
import { BOOK_RACES, BOOK_SPECIES_2024, RACES, SPECIES, allRaces, createCharacter, derive, getAbilityScores, legacyRaces, raceById, type CharacterDraft } from './index'

// 2024 species from books outside the SRD, and 2014 races played under 2024 rules.
const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral', rulesEdition: '2024',
  raceId: 'aasimar', backgroundId: 'soldier', classes: [{ classId: 'fighter', level: 1 }], abilityMethod: 'standard',
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, freeAbilityBonuses: ['str', 'str', 'con'],
  chosenSkills: ['acrobatics', 'perception'],
  ...over,
})
const sheet = (over: Partial<CharacterDraft> = {}) => derive(createCharacter(draft(over)))

describe('2024 book species', () => {
  it('lists SRD species, then book species, then legacy races, and only in 2024', () => {
    const ids = allRaces('2024').map(r => r.id)
    expect(ids.slice(0, SPECIES.length)).toEqual(SPECIES.map(r => r.id))
    for (const r of BOOK_SPECIES_2024) {
      expect(ids, r.id).toContain(r.id)
      expect(r.abilityBonuses).toEqual({})
      expect(r.languages).toEqual([])
      expect(r.source, r.id).toBeTruthy()
    }
    expect(raceById('aasimar', '2024')).toBeDefined()
    expect(raceById('rimekin')).toBeUndefined()
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('applies Aasimar resistances, darkvision, Light and its uses', () => {
    const d = sheet()
    expect(d.defenses.resistances).toEqual(expect.arrayContaining(['necrotic', 'radiant']))
    expect(d.senses.darkvision).toBe(60)
    expect(d.itemSpells.map(s => s.spell)).toContain('Light')
    const ids = d.resources.map(r => r.label)
    expect(ids).toContain('Healing Hands')
    expect(ids).not.toContain('Celestial Revelation')
    expect(sheet({ classes: [{ classId: 'fighter', level: 3 }] }).resources.map(r => r.label)).toContain('Celestial Revelation')
  })

  it('gives Shifting uses equal to the proficiency bonus and Warforged +1 AC', () => {
    expect(sheet({ raceId: 'shifter', classes: [{ classId: 'fighter', level: 5 }] }).resources.find(r => r.label === 'Shifting')?.max).toBe(3)
    expect(sheet({ raceId: 'warforged' }).armorClass.value).toBe(sheet({ raceId: 'human' }).armorClass.value + 1)
  })

  it('applies the Reborn Strange Endurance pick', () => {
    expect(sheet({ raceId: 'reborn', traitChoices: { strangeEndurance: 'necrotic' } }).defenses.resistances).toContain('necrotic')
  })
})

describe('legacy races under 2024 rules', () => {
  it('offers every 2014 race without a 2024 version, with no racial ability bonuses', () => {
    const legacy = legacyRaces()
    const has2024 = new Set([...SPECIES, ...BOOK_SPECIES_2024].map(r => r.id))
    expect(legacy.map(r => r.id)).toEqual([...RACES, ...BOOK_RACES['2014']].filter(r => !has2024.has(r.id)).map(r => r.id))
    expect(legacy.map(r => r.id)).toEqual(expect.arrayContaining(['half-elf', 'half-orc']))
    for (const r of legacy) {
      expect(r.legacy).toBe(true)
      expect(r.abilityBonuses).toEqual({})
      for (const s of r.subraces ?? []) expect(s.abilityBonuses).toEqual({})
    }
    // The 2014 list itself is untouched.
    expect(raceById('half-orc')?.abilityBonuses).toEqual({ str: 2, con: 1 })
  })

  it('takes ability bonuses from the background, not the old race', () => {
    const c = createCharacter(draft({ raceId: 'half-orc' }))
    expect(getAbilityScores(c)).toMatchObject({ str: 17, con: 14 })
    expect(derive(c).traits).toContain('Relentless Endurance')
  })
})
