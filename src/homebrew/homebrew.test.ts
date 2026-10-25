import { describe, expect, it } from 'vitest'
import { createCharacter, getArmorClass, getAttacks, itemById, registerHomebrewItems } from '../rules'
import { decodePack, encodeShareCode, entryId, featIssues, itemIssues, newPack, PackError, sanitizeEntry, sanitizePack, spellIssues } from './pack'
import type { HomebrewItem, HomebrewPack, HomebrewSpell } from './types'

const author = { id: 'u1', displayName: 'Ziv' }

const spell = (over: Partial<HomebrewSpell> = {}): HomebrewSpell => ({
  id: 'hb:abcd1234:ember-lance', name: 'Ember Lance', level: 1, school: 'Evocation', castingTime: '1 action',
  range: '60 feet', components: { v: true, s: true, m: false }, duration: 'Instantaneous', concentration: false,
  ritual: false, classes: ['wizard'], description: 'A spear of fire.', damage: '3d6', damageType: 'fire', save: 'dex',
  ...over,
})

const blade: HomebrewItem = {
  kind: 'weapon', id: 'hb:abcd1234:sunblade', name: 'Sunblade', category: 'martial', damage: '1d10',
  damageType: 'radiant', properties: ['finesse'], weight: 3, rarity: 'rare',
}

const pack = (): HomebrewPack => ({
  ...newPack('abcd1234', author, 'Test pack'),
  spells: [spell()],
  items: [blade],
  feats: [{ id: 'hb:abcd1234:iron-gut', name: 'Iron Gut', description: 'Tough stomach.', effects: [{ kind: 'hpPerLevel', amount: 1 }] }],
})

describe('homebrew ids', () => {
  it('namespaces ids by pack and avoids clashes', () => {
    const p = pack()
    expect(entryId(p, 'Fire Bolt!')).toBe('hb:abcd1234:fire-bolt')
    expect(entryId(p, 'Ember Lance')).toBe('hb:abcd1234:ember-lance-2')
  })
})

describe('editor validation', () => {
  it('checks dice notation and required text', () => {
    expect(spellIssues(spell())).toEqual([])
    expect(spellIssues(spell({ damage: 'lots' }))).toHaveLength(1)
    expect(spellIssues(spell({ components: { v: false, s: false, m: true } }))).toContain('Name the material component.')
    expect(itemIssues(blade)).toEqual([])
    expect(itemIssues({ ...blade, properties: ['versatile'] })).toContain('Versatile weapons need a two-handed damage die.')
    expect(itemIssues({ ...blade, properties: ['thrown'] })).toHaveLength(1)
    expect(featIssues({ id: '', name: '', description: '', effects: [] })).toHaveLength(2)
  })
})

describe('share codes', () => {
  it('round-trips a pack, including non-ASCII text', () => {
    const p = { ...pack(), name: 'Drachen–Brühe 🐉' }
    const code = encodeShareCode(p)
    expect(code.startsWith('FFHB1.')).toBe(true)
    expect(decodePack(code)).toEqual(p)
    expect(decodePack(JSON.stringify(p))).toEqual(p)
  })

  it('rejects things that are not packs', () => {
    expect(() => decodePack('hello')).toThrow(PackError)
    expect(() => decodePack('FFHB1.!!!')).toThrow(PackError)
    expect(() => decodePack('{"format":"other"}')).toThrow(PackError)
    expect(() => decodePack('{"format":"ff-homebrew","version":9,"id":"abcd1234"}')).toThrow(/newer version/)
  })
})

describe('sanitizing untrusted packs', () => {
  it('drops bad fields and clamps numbers', () => {
    const raw = {
      ...pack(),
      spells: [{ ...spell(), level: 42, school: 'Pyromancy', damage: 'alert(1)', save: 'luck', extra: '<script>' }],
      items: [{ ...blade, damage: 'big', properties: ['finesse', 'laser', 'finesse'], weight: -5 }, 'junk'],
      feats: [{ name: 'X', description: 'y', effects: [{ kind: 'ability', ability: 'luck' }, { kind: 'speed', amount: 1e9 }, { kind: 'fly' }] }],
    }
    const p = sanitizePack(raw)
    expect(p.spells[0]).toMatchObject({ level: 9, school: 'Evocation', damage: undefined, save: undefined })
    expect('extra' in p.spells[0]).toBe(false)
    expect(p.items).toHaveLength(1)
    expect(p.items[0]).toMatchObject({ damage: '1d4', properties: ['finesse'], weight: 0 })
    expect(p.feats[0].effects).toEqual([{ kind: 'speed', amount: 100 }])
  })

  it('keeps entries inside the pack namespace so a pack cannot shadow another', () => {
    const raw = { ...pack(), items: [{ ...blade, id: 'hb:otherpack:sunblade' }, { ...blade, id: 'longsword' }] }
    const ids = sanitizePack(raw).items.map(i => i.id)
    expect(ids).toEqual(['hb:abcd1234:sunblade', 'hb:abcd1234:sunblade-2'])
  })
})

describe('history in packs', () => {
  it('keeps history for files but leaves it out of share codes', () => {
    const p = { ...pack(), history: [{ id: 'r1' }] }
    expect(sanitizePack(JSON.parse(JSON.stringify(p))).history).toEqual([{ id: 'r1' }])
    expect(decodePack(encodeShareCode(p)).history).toBeUndefined()
  })

  it('rebuilds a restored version like an import', () => {
    const e = sanitizeEntry('items', { ...blade, id: 'longsword', damage: 'nope' }, 'abcd1234')
    expect(e).toMatchObject({ id: 'hb:abcd1234:sunblade', damage: '1d4' })
    expect(() => sanitizeEntry('spells', 'junk', 'abcd1234')).toThrow(PackError)
  })
})

describe('rules engine integration', () => {
  it('derives attacks and AC from registered homebrew items', () => {
    const shield: HomebrewItem = { kind: 'armor', id: 'hb:abcd1234:tower', name: 'Tower Shield', category: 'shield', baseAc: 3, weight: 15 }
    registerHomebrewItems([blade, shield])
    expect(itemById(blade.id)?.name).toBe('Sunblade')
    const c = createCharacter({
      name: 'T', ownerId: 'u1', playerName: '', alignment: 'True Neutral', raceId: 'human', backgroundId: 'acolyte',
      classes: [{ classId: 'fighter', level: 1 }], abilityMethod: 'standard',
      baseAbilities: { str: 10, dex: 15, con: 13, int: 12, wis: 14, cha: 8 }, freeAbilityBonuses: [], chosenSkills: [],
    })
    c.inventory = [
      { uid: '1', itemId: blade.id, qty: 1, equipped: true },
      { uid: '2', itemId: shield.id, qty: 1, equipped: true },
    ]
    const attack = getAttacks(c).find(a => a.name === 'Sunblade')
    expect(attack).toBeDefined()
    expect(attack?.damage).toContain('1d10')
    expect(attack?.bonus).toBe(5) // martial proficiency +2, finesse DEX +3
    expect(getArmorClass(c).value).toBe(10 + 3 + 3) // human DEX 16 = +3, shield +3
    registerHomebrewItems([])
  })
})
