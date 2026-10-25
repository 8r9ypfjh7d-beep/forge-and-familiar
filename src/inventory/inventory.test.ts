import { describe, expect, it } from 'vitest'
import type { Equipment, MagicItem } from '../content'
import type { Character } from '../model/character'
import { createCharacter, derive, ITEMS, type CharacterDraft } from '../rules'
import { addItem, fromLibrary, fromMagicItem, magicBonusOf, setCoins, setQty, updateEntry, withBase } from './inventory'

const warlock = (edition?: '2024'): Character => {
  const c = createCharacter({
    name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral', raceId: 'human', backgroundId: 'acolyte',
    classes: [{ classId: 'warlock', level: 7 }], abilityMethod: 'standard',
    baseAbilities: { str: 10, dex: 14, con: 12, int: 8, wis: 10, cha: 18 }, freeAbilityBonuses: [], chosenSkills: [],
  } satisfies CharacterDraft)
  c.inventory = []
  if (edition) c.spellEdition = edition
  return c
}

const greatsword = ITEMS.find(i => i.id === 'greatsword')!

describe('inventory', () => {
  it('stacks plain items and keeps custom ones apart', () => {
    let c = warlock()
    c = addItem(c, { itemId: 'rope' }).character
    c = addItem(c, { itemId: 'rope' }).character
    expect(c.inventory).toHaveLength(1)
    expect(c.inventory[0].qty).toBe(2)
    c = addItem(c, { itemId: 'custom:1', item: { kind: 'gear', id: 'custom', name: 'Prosthetic limb', weight: 4 } }).character
    expect(c.inventory).toHaveLength(2)
    expect(derive(c).carriedWeight).toBeGreaterThanOrEqual(4)
  })

  it('removes an entry at zero and clamps coins', () => {
    let c = warlock()
    const { character, uid } = addItem(c, { itemId: 'rope' })
    expect(setQty(character, uid, 0).inventory).toHaveLength(0)
    c = setCoins(c, 'gp', -5)
    expect(c.coins.gp).toBe(0)
  })

  it('keeps only one pact weapon', () => {
    let c = warlock()
    const a = addItem(c, { itemId: 'greatsword', pact: true }); c = a.character
    const b = addItem(c, { itemId: 'longsword' }); c = b.character
    c = updateEntry(c, b.uid, { pact: true })
    expect(c.inventory.filter(e => e.pact).map(e => e.uid)).toEqual([b.uid])
    expect(c.inventory.find(e => e.uid === a.uid)).not.toHaveProperty('pact')
  })

  it('maps library entries to engine items when it knows them', () => {
    const lib = { id: 'greatsword', name: 'Greatsword', type: 'weapon', weapon: {} } as unknown as Equipment
    expect(fromLibrary(lib)).toEqual({ itemId: 'greatsword' })
  })

  it('reads the magic bonus from a magic item name', () => {
    expect(magicBonusOf('Weapon, +2')).toBe(2)
    expect(magicBonusOf('Flame Tongue')).toBe(0)
    const m = { id: 'weapon-plus-1', name: 'Weapon, +1', description: 'You have a +1 bonus.' } as unknown as MagicItem
    expect(fromMagicItem(m)).toMatchObject({ magicBonus: 1, notes: 'You have a +1 bonus.' })
  })
})

describe('items feed attacks and AC', () => {
  const pactSword = (c: Character) => addItem(c, {
    itemId: 'pact-sword', item: withBase(greatsword, 'Soulreaver', 'pact-sword'), magicBonus: 1, pact: true, extraDamage: '1d6 necrotic',
  }).character

  it('turns an equipped custom magic weapon into an attack', () => {
    let c = pactSword(warlock())
    c = { ...c, inventory: c.inventory.map(e => ({ ...e, equipped: true })) }
    const atk = derive(c).attacks.find(a => a.name === 'Soulreaver')!
    // 2014: STR (+0) + proficiency (+3, pact weapon) + magic (+1)
    expect(atk.bonus).toBe(4)
    expect(atk.damage).toBe('2d6+1')
    expect(atk.extraDamage).toBe('1d6 necrotic')
  })

  it('uses Charisma for a 2024 pact weapon', () => {
    let c = pactSword(warlock('2024'))
    c = { ...c, inventory: c.inventory.map(e => ({ ...e, equipped: true })) }
    const atk = derive(c).attacks.find(a => a.name === 'Soulreaver')!
    // CHA (+4) + proficiency (+3) + magic (+1)
    expect(atk.bonus).toBe(8)
    expect(atk.damage).toBe('2d6+5')
  })

  it('adds magic armor to AC', () => {
    const c = warlock()
    c.inventory = [{ uid: 'a', itemId: 'leather', qty: 1, equipped: true, magicBonus: 2 }]
    // leather 11 + DEX 2 + magic 2
    expect(derive(c).armorClass.value).toBe(15)
  })

  it('ignores unequipped weapons', () => {
    const c = pactSword(warlock())
    expect(derive(c).attacks.some(a => a.name === 'Soulreaver')).toBe(false)
  })
})
