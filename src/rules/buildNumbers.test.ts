import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import { castingWith, createCharacter, derive, getItemSpells, getSpellcastingByClass, type CharacterDraft } from './index'

// Rules numbers the creation audit found wrong: fighting style damage, Keen Senses, thieves' tools expertise,
// species spell abilities and the 2014 Ranger's first-level DC.
const make = (over: Partial<CharacterDraft>, inventory?: string[]): Character => {
  const c = createCharacter({
    name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
    raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'paladin', level: 2 }],
    abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    freeAbilityBonuses: [], chosenSkills: ['athletics', 'insight'],
    ...over,
  })
  if (inventory) c.inventory = inventory.map((itemId, i) => ({ uid: String(i), itemId, qty: 1, equipped: true }))
  return c
}
const attack = (c: Character, name: string) => derive(c).attacks.find(a => a.name === name)

describe('fighting style damage', () => {
  it('adds Dueling to one-handed melee damage, not to two-handed or ranged', () => {
    // 2014 Human: STR 16 (+3).
    const c = make({ featureChoices: { 'paladin.fightingStyle': 'dueling' } }, ['longsword', 'shield', 'greatsword', 'longbow'])
    // The shield takes the other hand, so no two-handed line.
    expect(attack(c, 'Longsword')).toMatchObject({ damage: '1d8+5', versatile: undefined })
    expect(attack(c, 'Greatsword')?.damage).toBe('2d6+3')
    expect(attack(c, 'Longbow')?.damage).toBe('1d8+2')
    expect(attack(make({}, ['longsword']), 'Longsword')?.damage).toBe('1d8+3')
  })

  it('adds Dueling in 2024 through the style feat', () => {
    const c = make({ rulesEdition: '2024', raceId: 'orc', backgroundId: 'soldier', freeAbilityBonuses: ['str', 'str', 'con'], featureChoices: { 'paladin.fightingStyle': 'dueling' } }, ['longsword'])
    // STR 17 (+3).
    expect(attack(c, 'Longsword')?.damage).toBe('1d8+5')
  })

  it('gives Thrown Weapon Fighting a thrown line with +2 damage, both editions', () => {
    const c = make({ classes: [{ classId: 'fighter', level: 1 }], featureChoices: { 'fighter.fightingStyle': 'thrown-weapon-fighting' } }, ['javelin', 'longsword'])
    expect(attack(c, 'Javelin')?.damage).toBe('1d6+3')
    expect(attack(c, 'Javelin (thrown)')).toMatchObject({ damage: '1d6+5', range: '30/120' })
    expect(attack(c, 'Javelin (thrown)')?.reach).toBeUndefined()
    expect(attack(c, 'Longsword (thrown)')).toBeUndefined()
    const d = make({ rulesEdition: '2024', raceId: 'orc', backgroundId: 'soldier', freeAbilityBonuses: ['str', 'str', 'con'], classes: [{ classId: 'fighter', level: 1 }], featureChoices: { 'fighter.fightingStyle': 'thrown-weapon-fighting' } }, ['handaxe'])
    expect(attack(d, 'Handaxe (thrown)')?.damage).toBe('1d6+5')
    expect(attack(make({}, ['javelin']), 'Javelin (thrown)')).toBeUndefined()
  })
})

describe('2014 Ranger and Paladin spellcasting', () => {
  it('has no spell DC at level 1, then one from level 2', () => {
    expect(derive(make({ classes: [{ classId: 'ranger', level: 1 }] })).spellcasting).toBeUndefined()
    expect(getSpellcastingByClass(make({ classes: [{ classId: 'ranger', level: 1 }] }))).toEqual([])
    expect(derive(make({ classes: [{ classId: 'ranger', level: 2 }] })).spellcasting?.saveDc).toBe(10)
    expect(derive(make({ rulesEdition: '2024', raceId: 'orc', backgroundId: 'soldier', freeAbilityBonuses: ['str', 'str', 'con'], classes: [{ classId: 'ranger', level: 1 }] })).spellcasting).toBeDefined()
  })
})

describe('Rogue Expertise in thieves\' tools', () => {
  it('marks the tool as expertise without making it a skill', () => {
    const c = make({ classes: [{ classId: 'rogue', level: 1 }], chosenSkills: ['stealth', 'acrobatics', 'deception', 'insight'], classPicks: { 'rogue.expertise': ['stealth', "Thieves' tools"] } })
    const d = derive(c)
    expect(d.toolExpertise).toEqual(["Thieves' tools"])
    expect(d.skills.stealth.expertise).toBe(true)
  })
})

describe('2024 species spell ability', () => {
  const elf = (over: Partial<CharacterDraft> = {}) => make({
    rulesEdition: '2024', raceId: 'elf', subraceId: 'drow', backgroundId: 'soldier', freeAbilityBonuses: ['str', 'str', 'con'],
    classes: [{ classId: 'fighter', level: 1 }], chosenSkills: ['acrobatics', 'perception', 'insight'], ...over,
  })

  it('defaults to the best of INT, WIS and CHA and follows the pick', () => {
    // INT 12 beats WIS 10 and CHA 8.
    expect(getItemSpells(elf()).find(s => s.spell === 'Dancing Lights')?.ability).toBe('int')
    expect(getItemSpells(elf({ spellAbilities: { race: 'cha' } })).find(s => s.spell === 'Dancing Lights')?.ability).toBe('cha')
    expect(castingWith(elf(), 'int')).toEqual({ ability: 'int', saveDc: 11, attackBonus: 3 })
  })

  it('leaves 2014 race spells alone', () => {
    expect(getItemSpells(make({ raceId: 'tiefling' })).every(s => !s.ability)).toBe(true)
  })
})
