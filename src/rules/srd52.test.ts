import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import {
  CLASSES_2024, SPECIES, allFeats, classById, createCharacter, derive, getAbilityScores, getArmorClass, getAttacks, getCasterLevel,
  getProficiencies, getSpellSlots, getWeaponMasteryCount, raceById, subclassesFor, type CharacterDraft,
} from './index'

// 2024 rules (SRD 5.2), picked per character with rulesEdition: '2024'.
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

const make = (over: Partial<CharacterDraft> = {}, edit?: (c: Character) => void) => {
  const c = createCharacter(draft(over))
  edit?.(c)
  return c
}

const equipOnly = (c: Character, ...ids: string[]) => {
  c.inventory = ids.map((itemId, i) => ({ uid: String(i), itemId, qty: 1, equipped: true }))
}

describe('2024 content', () => {
  it('has the nine SRD 5.2 species and keeps 2014 races separate', () => {
    expect(SPECIES.map(r => r.id).sort()).toEqual(['dragonborn', 'dwarf', 'elf', 'gnome', 'goliath', 'halfling', 'human', 'orc', 'tiefling'])
    expect(raceById('orc', '2024')).toBeDefined()
    expect(raceById('orc')).toBeUndefined()
    expect(raceById('half-elf', '2024')).toBeUndefined()
  })

  it('has all twelve classes with a level 3 subclass and an SRD 5.2 subclass each', () => {
    expect(CLASSES_2024).toHaveLength(12)
    for (const c of CLASSES_2024) {
      expect(c.subclassLevel, c.id).toBe(3)
      expect(subclassesFor(c.id, '2024'), c.id).toHaveLength(1)
    }
    expect(classById('cleric')!.subclassLevel).toBe(1)
  })

  it('offers 2024 feats only to 2024 characters', () => {
    expect(allFeats('2024').map(f => f.id)).toContain('alert')
    expect(allFeats().map(f => f.id)).not.toContain('alert')
  })
})

describe('2024 origin', () => {
  it('takes ability bonuses from the background, not the species', () => {
    const scores = getAbilityScores(draft())
    expect(scores.str).toBe(17)
    expect(scores.con).toBe(14)
    expect(scores.dex).toBe(14)
  })

  it('ignores bonuses outside the background or past +2/+3', () => {
    const scores = getAbilityScores(draft({ freeAbilityBonuses: ['wis', 'str', 'str', 'str', 'dex'] }))
    expect(scores.wis).toBe(10)
    expect(scores.str).toBe(17)
    expect(scores.dex).toBe(15)
  })

  it('applies the background Origin feat: Criminal gives Alert', () => {
    const c = make({ backgroundId: 'criminal', freeAbilityBonuses: ['dex', 'dex', 'con'] })
    const d = derive(c)
    expect(d.feats).toContain('Alert')
    expect(d.initiative).toBe(3 + 2)
  })

  it('names Magic Initiate with its spell list', () => {
    expect(derive(make({ backgroundId: 'acolyte', freeAbilityBonuses: ['wis', 'wis', 'cha'] })).feats).toContain('Magic Initiate (Cleric)')
  })

  it('lets a Human pick a second Origin feat', () => {
    const c = make({ raceId: 'human', originFeatId: 'alert' })
    expect(derive(c).feats).toEqual(['Savage Attacker', 'Alert'])
  })

  it('teaches Common plus two picked languages', () => {
    const c = make({ chosenLanguages: ['Elvish', 'Giant'] })
    expect(derive(c).languages).toEqual(['Common', 'Elvish', 'Giant'])
  })

  it('gives species traits: Dwarven Toughness and Wood Elf speed', () => {
    const dwarf = make({ raceId: 'dwarf', classes: [{ classId: 'fighter', level: 3 }] })
    const human = make({ raceId: 'human', classes: [{ classId: 'fighter', level: 3 }] })
    expect(derive(dwarf).maxHp - derive(human).maxHp).toBe(3)
    expect(derive(make({ raceId: 'elf', subraceId: 'wood-elf' })).speed).toBe(35)
    expect(derive(make({ raceId: 'goliath', subraceId: 'stone-giant' })).speed).toBe(35)
  })

  it('starts with the kit coins of the class and background', () => {
    expect(make().coins.gp).toBe(4 + 14)
    expect(make({ equipmentPicks: [{ option: 2, items: [] }] }).coins.gp).toBe(155 + 14)
    expect(make({ equipmentPicks: [{ option: 2, items: [] }] }).inventory.map(e => e.itemId)).not.toContain('chain-mail')
  })
})

describe('2024 classes', () => {
  it('gives half casters slots from level 1 and rounds their multiclass levels up', () => {
    expect(getSpellSlots(make({ classes: [{ classId: 'paladin', level: 1 }] })).slots[0]).toBe(2)
    expect(getSpellSlots(make({ rulesEdition: undefined, raceId: 'human', classes: [{ classId: 'paladin', level: 1 }] })).slots[0]).toBe(0)
    const pr = { classes: [{ classId: 'paladin', level: 3 }, { classId: 'ranger', level: 3 }] }
    expect(getCasterLevel({ ...pr, rulesEdition: '2024' }).casterLevel).toBe(4)
    expect(getCasterLevel(pr).casterLevel).toBe(2)
  })

  it('uses 2024 resource counts', () => {
    const d = derive(make({ classes: [{ classId: 'fighter', level: 9 }], featureChoices: { 'fighter.fightingStyle': 'defense' } }))
    const byId = Object.fromEntries(d.resources.map(r => [r.id, r.max]))
    expect(byId['second-wind']).toBe(3)
    expect(byId['indomitable']).toBe(1)
    expect(derive(make({ classes: [{ classId: 'monk', level: 5 }] })).resources.find(r => r.id === 'focus')?.max).toBe(5)
  })

  it('applies Fighting Style feats: Defense in armor, Archery on ranged attacks', () => {
    const def = make({ featureChoices: { 'fighter.fightingStyle': 'defense' } }, c => equipOnly(c, 'chain-mail'))
    expect(getArmorClass(def).value).toBe(17)
    const arch = make({ featureChoices: { 'fighter.fightingStyle': 'archery' } }, c => equipOnly(c, 'longbow', 'longsword'))
    const [bow, sword] = getAttacks(arch)
    expect(bow.bonus).toBe(2 + 2 + 2)
    expect(sword.bonus).toBe(3 + 2)
  })

  it('grants Divine Order: Protector heavy armor and martial weapons', () => {
    const c = draft({ classes: [{ classId: 'cleric', level: 1 }], featureChoices: { 'cleric.divineOrder': 'protector' } })
    const p = getProficiencies(c)
    expect(p.armor.has('heavy')).toBe(true)
    expect(p.weapons.has('martial')).toBe(true)
    expect(getProficiencies({ ...c, featureChoices: { 'cleric.divineOrder': 'thaumaturge' } }).armor.has('heavy')).toBe(false)
  })

  it('counts Weapon Mastery by class level', () => {
    expect(getWeaponMasteryCount(make({ classes: [{ classId: 'fighter', level: 4 }] }))).toBe(4)
    expect(getWeaponMasteryCount(make({ classes: [{ classId: 'wizard', level: 4 }] }))).toBe(0)
    expect(getWeaponMasteryCount(make({ rulesEdition: undefined, raceId: 'human', classes: [{ classId: 'fighter', level: 4 }] }))).toBe(0)
  })

  it('uses the 2024 Martial Arts die and Light martial monk weapons', () => {
    const c = make({
      classes: [{ classId: 'monk', level: 1 }],
      baseAbilities: { str: 8, dex: 15, con: 13, int: 10, wis: 14, cha: 12 },
      freeAbilityBonuses: ['dex', 'dex', 'con'],
    }, x => equipOnly(x, 'shortsword'))
    const attacks = getAttacks(c)
    expect(attacks[0].ability).toBe('dex')
    expect(attacks[0].proficient).toBe(true)
    expect(attacks[1].damage).toBe('1d6+3')
  })

  it('gives Draconic Sorcery 10 + DEX + CHA unarmored', () => {
    const c = make({
      classes: [{ classId: 'sorcerer', level: 3, subclassId: 'draconic-sorcery' }],
      baseAbilities: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 },
    }, x => equipOnly(x))
    expect(getArmorClass(c).value).toBe(10 + 2 + 2)
  })

  it('raises a score past 20 with an Epic Boon', () => {
    const c = draft({
      classes: [{ classId: 'fighter', level: 19 }],
      baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      improvements: [
        { classId: 'fighter', level: 4, abilities: { str: 2 } },
        { classId: 'fighter', level: 6, abilities: { str: 1, con: 1 } },
        { classId: 'fighter', level: 19, featId: 'boon-of-combat-prowess', featAbility: 'str' },
      ],
    })
    expect(getAbilityScores(c).str).toBe(21)
  })
})

describe('older saves', () => {
  it('keeps 2014 rules for a character that only switched its spells to 2024', () => {
    const c = make({ rulesEdition: undefined, raceId: 'human', backgroundId: 'acolyte', freeAbilityBonuses: [], spellEdition: '2024' })
    expect(getAbilityScores(c).str).toBe(16)
  })
})
