import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import { explain } from '../explain/math'
import { CLASSES, createCharacter, derive, getResources, type CharacterDraft } from './index'

const make = (classId: string, level: number, over: Partial<CharacterDraft> = {}, edit?: (c: Character) => void): Character => {
  const c = createCharacter({
    name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral', raceId: 'human', backgroundId: 'acolyte',
    classes: [{ classId, level }], abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    freeAbilityBonuses: [], chosenSkills: [], ...over,
  })
  edit?.(c)
  return c
}
const names = (c: Character) => derive(c).features.map(f => f.name)
const feature = (c: Character, name: string) => derive(c).features.find(f => f.name === name)
const equip = (c: Character, ...ids: string[]) => { c.inventory = ids.map((itemId, i) => ({ uid: String(i), itemId, qty: 1, equipped: true })) }

describe('2014 class features to level 20', () => {
  it('lists features past level 5 for every class, each name once', () => {
    for (const cls of CLASSES) {
      expect(cls.features.some(f => f.level > 5), cls.id).toBe(true)
      const list = cls.features.map(f => f.name)
      expect(new Set(list).size, cls.id).toBe(list.length)
    }
    expect(names(make('barbarian', 20))).toEqual(expect.arrayContaining(['Feral Instinct', 'Brutal Critical', 'Relentless Rage', 'Persistent Rage', 'Indomitable Might', 'Primal Champion']))
    expect(names(make('barbarian', 6))).not.toContain('Feral Instinct')
  })

  it('shows what grows with level', () => {
    expect(feature(make('barbarian', 13), 'Brutal Critical')?.detail).toBe('+2 dice')
    expect(feature(make('bard', 10), 'Bardic Inspiration')?.detail).toBe('d10')
    expect(feature(make('cleric', 11), 'Destroy Undead')?.detail).toBe('CR 2')
    expect(feature(make('fighter', 11), 'Extra Attack')?.detail).toBe('3 attacks')
    expect(feature(make('rogue', 9), 'Sneak Attack')?.detail).toBe('5d6')
    expect(feature(make('warlock', 17), 'Mystic Arcanum')?.detail).toBe('levels 6–9')
    expect(feature(make('wizard', 20), 'Signature Spells')?.detail).toBeUndefined()
  })

  it('adds the new resources at their levels', () => {
    const ids = (c: Character) => Object.fromEntries(getResources(c).map(r => [r.id, r.max]))
    expect(ids(make('fighter', 13))).toMatchObject({ indomitable: 2 })
    expect(ids(make('fighter', 8)).indomitable).toBeUndefined()
    expect(ids(make('cleric', 10))).toMatchObject({ 'divine-intervention': 1 })
    expect(ids(make('paladin', 14))).toMatchObject({ 'cleansing-touch': 1 })
    expect(ids(make('warlock', 15))).toMatchObject({ 'mystic-arcanum-6': 1, 'mystic-arcanum-7': 1, 'mystic-arcanum-8': 1 })
    expect(ids(make('warlock', 15))['mystic-arcanum-9']).toBeUndefined()
    expect(ids(make('warlock', 20))).toMatchObject({ 'mystic-arcanum-9': 1, 'eldritch-master': 1 })
    expect(ids(make('rogue', 20))).toMatchObject({ 'stroke-of-luck': 1 })
    expect(ids(make('wizard', 20))).toMatchObject({ 'signature-spells': 2 })
    expect(ids(make('druid', 20))).toMatchObject({ 'wild-shape': 99 })
  })

  it('applies passive features to the sheet', () => {
    const monk = derive(make('monk', 14))
    expect(Object.values(monk.saves).every(s => s.proficient)).toBe(true)
    expect(monk.defenses.immunities).toContain('poison')
    expect(monk.defenses.conditionImmunities).toContain('poisoned')
    expect(monk.attacks.find(a => a.name === 'Unarmed Strike')?.notes).toContain('magical')
    expect(derive(make('barbarian', 7)).initiativeAdvantage).toBe(true)
    expect(derive(make('barbarian', 2)).advantages.some(a => a.on === 'save:dex' && a.when)).toBe(true)
    expect(derive(make('rogue', 15)).saves.wis.proficient).toBe(true)
    expect(derive(make('rogue', 14)).senses.blindsight).toBe(10)
    const champ = derive(make('barbarian', 20))
    expect([champ.abilities.str, champ.abilities.con]).toEqual([20, 18])
    expect(derive(make('paladin', 10)).defenses.conditionImmunities).toContain('frightened')
  })

  it('adds Aura of Protection to every save, at least +1, and shows it in the math', () => {
    const low = make('paladin', 6)
    expect(derive(low).saves.str.bonus).toBe(derive(make('paladin', 5)).saves.str.bonus + 1)
    const high = make('paladin', 6, { baseAbilities: { str: 15, dex: 8, con: 13, int: 10, wis: 12, cha: 16 } })
    expect(derive(high).saves.dex.bonus).toBe(-1 + 3)
    expect(explain(high, 'save:dex')?.lines.some(l => l.label.startsWith('Aura of Protection'))).toBe(true)
  })

  it('adds radiant damage and Brutal Critical to melee weapon attacks', () => {
    const paladin = make('paladin', 11, {}, c => equip(c, 'longsword', 'longbow'))
    const [sword, bow] = derive(paladin).attacks
    expect(sword.extraDamage).toBe('1d8 radiant')
    expect(bow.extraDamage).toBeUndefined()
    const barb = make('barbarian', 17, {}, c => equip(c, 'greataxe'))
    expect(derive(barb).attacks[0].notes).toContain('crit +3 dice (Brutal Critical)')
  })

  it('applies the same passives to 2024 classes', () => {
    const monk = derive(make('monk', 14, { rulesEdition: '2024' }))
    expect(Object.values(monk.saves).every(s => s.proficient)).toBe(true)
    expect(derive(make('rogue', 15, { rulesEdition: '2024' })).saves.cha.proficient).toBe(true)
    expect(derive(make('ranger', 18, { rulesEdition: '2024' })).senses.blindsight).toBe(30)
    const paladin = make('paladin', 11, { rulesEdition: '2024' }, c => equip(c, 'longsword'))
    expect(derive(paladin).attacks[0].notes).toContain('Radiant Strikes')
  })
})
