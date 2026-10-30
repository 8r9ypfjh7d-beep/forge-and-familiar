import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import { createCharacter, derive, featureUseContext, hasLucky, planUse, type CharacterDraft } from './index'

// Rules the play audit found the sheet ignoring: Great Weapon and Unarmed Fighting, the Martial Arts die on
// Monk weapons, Bear Totem rage and Halfling Lucky.
const make = (over: Partial<CharacterDraft>, inventory?: string[]): Character => {
  const c = createCharacter({
    name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
    raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'fighter', level: 1 }],
    abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    freeAbilityBonuses: [], chosenSkills: ['athletics', 'insight'],
    ...over,
  })
  if (inventory) c.inventory = inventory.map((itemId, i) => ({ uid: String(i), itemId, qty: 1, equipped: true }))
  return c
}
const attack = (c: Character, name: string) => derive(c).attacks.find(a => a.name === name)

describe('Great Weapon Fighting', () => {
  it('marks two-handed and versatile melee weapons: reroll in 2014, 3s in 2024', () => {
    const c = make({ featureChoices: { 'fighter.fightingStyle': 'great-weapon-fighting' } }, ['greatsword', 'longsword', 'longbow'])
    expect(attack(c, 'Greatsword')?.greatWeapon).toBe('reroll')
    expect(attack(c, 'Longsword')?.greatWeapon).toBe('reroll')
    expect(attack(c, 'Longbow')?.greatWeapon).toBeUndefined()
    const c24 = make({ rulesEdition: '2024', backgroundId: 'soldier', featureChoices: { 'fighter.fightingStyle': 'great-weapon-fighting' } }, ['greatsword'])
    expect(attack(c24, 'Greatsword')?.greatWeapon).toBe('min3')
    expect(attack(make({}, ['greatsword']), 'Greatsword')?.greatWeapon).toBeUndefined()
  })

  it('a shield makes a versatile weapon one-handed: no two-handed damage, no Great Weapon Fighting', () => {
    const c = make({ featureChoices: { 'fighter.fightingStyle': 'great-weapon-fighting' } }, ['longsword', 'shield'])
    expect(attack(c, 'Longsword')).toMatchObject({ versatile: undefined })
    expect(attack(c, 'Longsword')?.greatWeapon).toBeUndefined()
    expect(attack(c, 'Longsword')?.notes.some(n => n.startsWith('two-handed'))).toBe(false)
  })
})

describe('Unarmed Fighting', () => {
  it('1d8 with hands free, 1d6 holding a weapon or shield', () => {
    const style = { featureChoices: { 'fighter.fightingStyle': 'unarmed-fighting' } }
    // 2014 Human: STR 16 (+3).
    expect(attack(make(style, []), 'Unarmed Strike')?.damage).toBe('1d8+3')
    expect(attack(make(style, ['shield']), 'Unarmed Strike')?.damage).toBe('1d6+3')
    expect(attack(make(style, ['dagger']), 'Unarmed Strike')?.damage).toBe('1d6+3')
    expect(attack(make({}, []), 'Unarmed Strike')?.damage).toBe('4')
  })
})

describe('Monk', () => {
  const monk = (edition: '2014' | '2024', level: number, inv: string[]) => make({
    ...(edition === '2024' ? { rulesEdition: '2024' as const, backgroundId: 'soldier' } : {}), classes: [{ classId: 'monk', level }],
    baseAbilities: { str: 10, dex: 15, con: 13, int: 12, wis: 14, cha: 8 },
  }, inv)

  it('a Monk weapon uses the Martial Arts die when it is higher', () => {
    // 2024 monk 5: Martial Arts d8 beats the spear's d6 (and matches its two-handed d8).
    expect(attack(monk('2024', 5, ['spear']), 'Spear')).toMatchObject({ damage: '1d8+2', versatile: '1d8+2' })
    // 2014 monk 1 (Human, DEX 16): d4 is lower than the spear's d6.
    expect(attack(monk('2014', 1, ['spear']), 'Spear')?.damage).toBe('1d6+3')
  })

  it('Extra Attack shows on Unarmed Strike', () => {
    expect(attack(monk('2024', 5, []), 'Unarmed Strike')?.attacks).toBe(2)
    expect(attack(monk('2024', 4, []), 'Unarmed Strike')?.attacks).toBeUndefined()
  })
})

describe('Bear Totem rage', () => {
  it('resists every damage type but psychic while raging; other totems keep B/P/S', () => {
    const barb = (spirit: string) => {
      const c = make({ classes: [{ classId: 'barbarian', level: 3, subclassId: 'totem-warrior' }] })
      return { ...c, classOptions: [{ kind: 'totemSpirit', id: spirit, classId: 'barbarian' }] }
    }
    const resists = (c: Character) => (planUse('rage', 'Rage', featureUseContext(c, 'rage')).effect?.stats ?? [])
      .flatMap(s => (s.kind === 'resistance' ? [s.damage] : []))
    expect(resists(barb('totem-bear'))).toContain('fire')
    expect(resists(barb('totem-bear'))).not.toContain('psychic')
    expect(resists(barb('totem-wolf'))).toEqual(['bludgeoning', 'piercing', 'slashing'])
  })
})

describe('Halfling Lucky', () => {
  it('halflings in both editions have it, others do not', () => {
    expect(hasLucky(make({ raceId: 'halfling', subraceId: 'lightfoot' }))).toBe(true)
    expect(hasLucky(make({ raceId: 'halfling', rulesEdition: '2024', backgroundId: 'soldier' }))).toBe(true)
    expect(derive(make({ raceId: 'halfling', subraceId: 'lightfoot' })).lucky).toBe(true)
    expect(hasLucky(make({}))).toBe(false)
  })
})
