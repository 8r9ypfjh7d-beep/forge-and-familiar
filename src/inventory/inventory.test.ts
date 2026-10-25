import { describe, expect, it } from 'vitest'
import type { Equipment, MagicItem } from '../content'
import type { Character } from '../model/character'
import { createCharacter, derive, ITEMS, type CharacterDraft } from '../rules'
import {
  addItem, attunementFull, fromLibrary, fromMagicItem, magicBonusOf, removeEntry, setAttuned, setCoins, setEquipped, setQty, updateEntry, withBase,
} from './inventory'

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

describe('magic item effects reach the sheet', () => {
  const magic = (id: string, name: string, attunement = true) =>
    fromMagicItem({ id, name, description: '', attunement, category: 'ring', rarity: 'rare', variants: [] } as unknown as MagicItem)

  const wear = (c: Character, uid: string) => setEquipped(c, uid, true)

  it('applies a Ring of Protection only once worn and attuned', () => {
    let c = warlock()
    const before = derive(c)
    const { character, uid } = addItem(c, magic('ring-of-protection', 'Ring of Protection'))
    c = wear(character, uid)
    expect(derive(c).armorClass.value).toBe(before.armorClass.value)
    c = setAttuned(c, uid, true)
    const after = derive(c)
    expect(after.armorClass.value).toBe(before.armorClass.value + 1)
    expect(after.saves.wis.bonus).toBe(before.saves.wis.bonus + 1)
    // Removing the item frees its attunement slot.
    expect(removeEntry(c, uid).state.attuned).toEqual([])
  })

  it('raises ability scores and everything built on them', () => {
    let c = warlock()
    const { character, uid } = addItem(c, magic('amulet-of-health', 'Amulet of Health'))
    c = setAttuned(wear(character, uid), uid, true)
    const d = derive(c)
    expect(d.abilities.con).toBe(19)
    expect(d.maxHp).toBeGreaterThan(derive(warlock()).maxHp)
  })

  it('never lowers a score above the item value', () => {
    let c = warlock()
    const { character, uid } = addItem(c, magic('gauntlets-of-ogre-power', 'Gauntlets of Ogre Power'))
    c = setAttuned(wear(character, uid), uid, true)
    c.baseAbilities = { ...c.baseAbilities, str: 20 }
    expect(derive(c).abilities.str).toBe(20)
  })

  it('adds spell attack bonuses and allows edited effects', () => {
    let c = warlock()
    const base = derive(c).spellcasting!
    const { character, uid } = addItem(c, magic('wand-of-the-war-mage-2', 'Wand of the War Mage +2'))
    c = setAttuned(wear(character, uid), uid, true)
    expect(derive(c).spellcasting!.attackBonus).toBe(base.attackBonus + 2)
    c = updateEntry(c, uid, { effects: [{ kind: 'spellDc', value: 1 }] })
    expect(derive(c).spellcasting).toMatchObject({ attackBonus: base.attackBonus, saveDc: base.saveDc + 1 })
  })

  it('bracers only count without armor', () => {
    let c = warlock()
    const { character, uid } = addItem(c, magic('bracers-of-defense', 'Bracers of Defense'))
    c = setAttuned(wear(character, uid), uid, true)
    const bare = derive(c).armorClass.value
    c = addItem(c, { itemId: 'leather' }).character
    c = setEquipped(c, c.inventory.at(-1)!.uid, true)
    expect(derive(c).armorClass.value).toBe(bare - 2 + 1) // leather 11 vs unarmored 10, bracers off
  })

  it('stops at three attuned items', () => {
    let c = warlock()
    for (let i = 0; i < 4; i++) {
      const { character, uid } = addItem(c, magic('ring-of-protection', 'Ring of Protection'))
      c = setAttuned(character, uid, true)
    }
    expect(c.state.attuned).toHaveLength(3)
    expect(attunementFull(c)).toBe(true)
  })

  it('fills in magic weapon bonuses from the table', () => {
    expect(magic('defender', 'Defender')).toMatchObject({ magicBonus: 3, attunement: true })
    expect(magic('flame-tongue', 'Flame Tongue')).toMatchObject({ extraDamage: '2d6 fire' })
  })
})
