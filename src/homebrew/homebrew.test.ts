import { describe, expect, it } from 'vitest'
import {
  backgroundsFor, createCharacter, derive, featSkillPicks, fixedLanguages, fixedTools, getAbilityScores, getArmorClass, getAttacks, getBackground,
  getFeats, getSkillProficiencies, itemById, registerHomebrewBackgrounds, registerHomebrewFeats, registerHomebrewItems, startingGold, toolPickGroups,
} from '../rules'
import { toBackground } from './store'
import { backgroundIssues, decodePack, encodeShareCode, entryId, featIssues, itemIssues, newPack, PackError, sanitizeEntry, sanitizePack, spellIssues } from './pack'
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

describe('homebrew races and subclasses', () => {
  it('sanitizes races and subclasses and keeps them in the pack namespace', () => {
    const pack = sanitizePack({
      format: 'ff-homebrew', version: 1, id: 'abcd1234', name: 'Book', updatedAt: '2026-10-25T00:00:00Z',
      races: [
        { id: 'elf', name: 'Wood Elf', parentRaceId: 'elf', abilityBonuses: { wis: 1, str: 99, bad: 3 }, traits: ['Fleet of Foot', 42], speed: 999 },
        { name: 'Tabaxi', size: 'Huge', skillProficiencies: ['perception', 'flying'], languageChoices: 1 },
      ],
      subclasses: [{ name: 'Battle Master', classId: 'fighter', features: [{ level: 3, name: 'Combat Superiority' }, { level: 99 }], armor: ['heavy', 'mithral'] }],
    })
    expect(pack.races[0]).toMatchObject({ id: 'hb:abcd1234:wood-elf', parentRaceId: 'elf', abilityBonuses: { wis: 1, str: 5 }, traits: ['Fleet of Foot'], speed: 120 })
    expect(pack.races[1]).toMatchObject({ size: 'Medium', skillProficiencies: ['perception'], languageChoices: 1 })
    expect(pack.subclasses[0]).toMatchObject({ id: 'hb:abcd1234:battle-master', features: [{ level: 3, name: 'Combat Superiority' }, { level: 20, name: 'Feature' }], armor: ['heavy'] })
    expect(sanitizePack({ format: 'ff-homebrew', version: 1, id: 'abcd1234' }).races).toEqual([])
  })
})

describe('homebrew backgrounds', () => {
  const raw = {
    format: 'ff-homebrew', version: 1, id: 'abcd1234', name: 'Sea', updatedAt: '2026-10-30T00:00:00Z',
    feats: [{ id: 'hb:abcd1234:sea-legs', name: 'Sea Legs', description: 'Steady.', effects: [{ kind: 'speed', amount: 5 }] }],
    backgrounds: [{
      name: 'Sea Wanderer', editions: 'both', feature: "Ship's Passage", featureText: 'Free passage on ships.',
      skillProficiencies: ['athletics', 'perception', 'flying'], tools: ["Navigator's tools"], toolChoices: 1, toolChoiceFrom: [],
      languages: ['Aquan'], languageChoices: 1, equipment: ['dagger', 'hb:abcd1234:x', '<bad>'], gold: 12,
      abilityScores: ['str', 'dex', 'wis', 'cha'], originFeatId: 'hb:abcd1234:sea-legs',
      effects: [{ kind: 'ability', ability: 'con', amount: 1 }, { kind: 'skillPicks', count: 2 }, { kind: 'initiativeProficiency' }, { kind: 'fly' }],
    }],
  }

  const draft = (rulesEdition: '2014' | '2024') => ({
    name: 'T', ownerId: 'u1', playerName: '', alignment: 'True Neutral', raceId: 'human', backgroundId: 'hb:abcd1234:sea-wanderer',
    classes: [{ classId: 'fighter', level: 1 }], abilityMethod: 'standard' as const, ...(rulesEdition === '2024' ? { rulesEdition } : {}),
    baseAbilities: { str: 10, dex: 14, con: 13, int: 12, wis: 15, cha: 8 }, freeAbilityBonuses: [], chosenSkills: [],
  })

  it('sanitizes every background field', () => {
    const b = sanitizePack(raw).backgrounds[0]
    expect(b).toMatchObject({
      id: 'hb:abcd1234:sea-wanderer', editions: 'both', skillProficiencies: ['athletics', 'perception'],
      equipment: ['dagger', 'hb:abcd1234:x'], abilityScores: ['str', 'dex', 'wis'], gold: 12,
    })
    expect(b.effects.map(e => e.kind)).toEqual(['ability', 'skillPicks', 'initiativeProficiency'])
    expect(sanitizePack({ format: 'ff-homebrew', version: 1, id: 'abcd1234' }).backgrounds).toEqual([])
    expect(backgroundIssues({ ...b, abilityScores: ['str'] })).toHaveLength(1)
    expect(backgroundIssues({ ...b, editions: '2014', abilityScores: [] })).toEqual([])
  })

  it('lists the background in the editions it is for and applies it to characters', () => {
    const p = sanitizePack(raw)
    registerHomebrewFeats(p.feats)
    registerHomebrewBackgrounds(p.backgrounds.map(toBackground))
    expect(backgroundsFor('2014').map(b => b.id)).toContain('hb:abcd1234:sea-wanderer')
    expect(backgroundsFor('2024').map(b => b.id)).toContain('hb:abcd1234:sea-wanderer')

    const old = createCharacter(draft('2014'))
    expect(getBackground(old)?.feat).toBeUndefined()
    expect(getSkillProficiencies(old).has('athletics')).toBe(true)
    expect(fixedTools(old)).toContain("Navigator's tools")
    expect(toolPickGroups(old)[0]).toMatchObject({ count: 1 })
    expect(fixedLanguages(old)).toContain('Aquan')
    expect(featSkillPicks(old)).toBe(2)
    expect(getAbilityScores(old).con).toBe(13 + 1 + 1) // human +1, background effect +1
    expect(old.inventory.some(i => i.itemId === 'dagger')).toBe(true)
    expect(startingGold(draft('2014'))).toBe(27)

    const now = createCharacter(draft('2024'))
    expect(getFeats(now).map(f => f.id)).toContain('hb:abcd1234:sea-legs')
    expect(derive(now).speed).toBe(derive(old).speed + 5)

    registerHomebrewBackgrounds(p.backgrounds.map(b => toBackground({ ...b, editions: '2014' })))
    expect(backgroundsFor('2024').map(b => b.id)).not.toContain('hb:abcd1234:sea-wanderer')
    registerHomebrewBackgrounds([])
    registerHomebrewFeats([])
  })
})
