import { describe, expect, it } from 'vitest'
import {
  allLanguages, allRaces, allTools, backgroundsFor, createCharacter, derive, featSkillPicks, fixedLanguages, fixedTools, getAbilityScores, getArmorClass, getAttacks,
  getBackground, getFeats, raceProfile, getSkillProficiencies, homebrewProficiencyText, itemById, registerHomebrewBackgrounds, registerHomebrewFeats,
  registerHomebrewItems, registerHomebrewProficiencies, registerHomebrewRaces, startingGold, toolPickGroups,
} from '../rules'
import { toBackground, toRace } from './store'
import {
  backgroundIssues, classOptionIssues, decodePack, encodeShareCode, entryId, featIssues, itemIssues, languageIssues, newPack, PackError, raceIssues, sanitizeEntry,
  sanitizePack, spellIssues, toolIssues,
} from './pack'
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

  it('keeps every feat mechanic through a share, and drops junk', () => {
    const feat = {
      id: 'hb:abcd1234:moon', name: 'Moon', description: 'Glows.',
      effects: [{ kind: 'abilityChoice', from: ['wis', 'nope'], max: 20, save: true }, { kind: 'skillPicks', count: 2 }, { kind: 'initiativeProficiency' }],
      stats: [{ kind: 'resistance', damage: 'radiant' }, { kind: 'bogus' }],
      uses: { count: 'pb', recharge: 'short', label: 'Beams' },
      armor: ['heavy', 'cardboard'], weapons: ['martial'],
    }
    const out = sanitizePack({ ...pack(), feats: [feat] }).feats[0]
    expect(out.effects).toEqual([{ kind: 'abilityChoice', from: ['wis'], max: 20, save: true }, { kind: 'skillPicks', count: 2 }, { kind: 'initiativeProficiency' }])
    expect(out.stats).toEqual([{ kind: 'resistance', damage: 'radiant' }])
    expect(out.uses).toEqual({ count: 'pb', recharge: 'short', label: 'Beams' })
    expect(out.armor).toEqual(['heavy'])
    expect(out.weapons).toEqual(['martial'])
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

describe('homebrew class options', () => {
  const raw = {
    ...newPack('abcd1234', author, 'Options'),
    classOptions: [
      { id: 'hb:other:steal', kind: 'invocation', name: 'Grave Sight', text: 'See the dead.', classIds: ['warlock', '<b>'], minLevel: 5, cost: 99,
        uses: { count: 'pb', recharge: 'long' }, effects: [{ kind: 'sense', sense: 'darkvision', value: 120 }, { kind: 'bogus' }] },
      { kind: 'infusion', name: 'Ember Blade', text: 'Hot.', classIds: ['artificer'], effects: [{ kind: 'ac', value: 5 }],
        item: { magicBonus: 7, effects: [{ kind: 'resistance', damage: 'cold' }] } },
      { kind: 'metamagic', name: 'Echo', text: 'Again.', classIds: ['sorcerer'], cost: 1, costPerSpellLevel: true, repeatable: true },
      { kind: 'nonsense', name: 'X', text: 'Y', classIds: ['fighter'] },
    ],
  }

  it('rebuilds options from untrusted packs', () => {
    const [grave, ember, echo, x] = sanitizePack(raw).classOptions
    expect(grave.id).toBe('hb:abcd1234:grave-sight')
    expect(grave.classIds).toEqual(['warlock'])
    expect(grave).toMatchObject({ minLevel: 5, cost: 20, uses: { count: 'pb', recharge: 'long' }, effects: [{ kind: 'sense', sense: 'darkvision', value: 120 }] })
    // An infusion's effects belong to the item, never to the artificer.
    expect(ember.effects).toBeUndefined()
    expect(ember.item).toEqual({ magicBonus: 3, effects: [{ kind: 'resistance', damage: 'cold' }] })
    expect(echo).toMatchObject({ cost: 1, costPerSpellLevel: true, repeatable: true })
    expect(x.kind).toBe('invocation')
  })

  it('loads packs saved before class options existed', () => {
    const { classOptions: _, ...old } = newPack('abcd1234', author, 'Old')
    expect(sanitizePack(old).classOptions).toEqual([])
  })

  it('validates the editor and survives share codes', () => {
    const p = sanitizePack(raw)
    expect(classOptionIssues(p.classOptions[0])).toEqual([])
    expect(classOptionIssues({ ...p.classOptions[0], name: '', classIds: [] })).toHaveLength(2)
    expect(decodePack(encodeShareCode(p)).classOptions).toEqual(p.classOptions)
    expect(sanitizeEntry('classOptions', p.classOptions[2], p.id)).toEqual(p.classOptions[2])
  })
})

describe('homebrew species for 2024 and every trait type', () => {
  const raw = {
    format: 'ff-homebrew', version: 1, id: 'abcd1234', name: 'Book', updatedAt: '2026-10-30T00:00:00Z',
    races: [{
      name: 'Shellkin', size: 'Small', sizeOptions: ['Medium', 'Gargantuan'], speed: 25, edition: '2024', abilityBonuses: { con: 2 },
      effects: [{ kind: 'sense', sense: 'darkvision', value: 60 }, { kind: 'resistance', damage: 'cold' }, { kind: 'moveSpeed', mode: 'swim', value: 0 }, { kind: 'bogus' }],
      tools: ["Cook's utensils"], toolChoices: 1, armor: ['light', 'plate'], weapons: ['martial'], naturalArmor: 13,
      choice: { name: 'Tide', options: [{ name: 'Ebb', detail: 'Cold blood', effects: [{ kind: 'immunity', damage: 'cold' }] }, { name: 'Flow', detail: 'Quick' }, { name: '' }] },
    }],
    languages: [{ name: 'Seaspeak', kind: 'rare', script: 'Shells' }, { name: 'Seaspeak', kind: 'loud' }],
    tools: [{ name: 'Tide charts', kind: 'other', ability: 'wis' }],
  }

  it('sanitizes the new race fields, languages and tools', () => {
    const p = sanitizePack(raw)
    expect(p.races[0]).toMatchObject({
      edition: '2024', sizeOptions: ['Medium'], tools: ["Cook's utensils"], toolChoices: 1, armor: ['light'], weapons: ['martial'], naturalArmor: 13,
      choice: { name: 'Tide', options: [{ name: 'Ebb', effects: [{ kind: 'immunity', damage: 'cold' }] }, { name: 'Flow' }] },
    })
    expect(p.races[0].effects).toHaveLength(3)
    expect(p.languages).toMatchObject([{ id: 'hb:abcd1234:seaspeak', name: 'Seaspeak', kind: 'rare', script: 'Shells' }, { id: 'hb:abcd1234:seaspeak-2', kind: 'standard' }])
    expect(p.tools).toMatchObject([{ id: 'hb:abcd1234:tide-charts', kind: 'other', ability: 'wis' }])
    // Packs from before languages and tools load with empty lists; plain races stay as they were.
    const old = sanitizePack({ format: 'ff-homebrew', version: 1, id: 'abcd1234', races: [{ name: 'Plain' }] })
    expect(old.languages).toEqual([])
    expect(old.tools).toEqual([])
    expect(Object.keys(old.races[0])).not.toContain('effects')
  })

  it('plays as a 2024 species: background bonuses, size pick, lineage effects, natural armor, tools and training', () => {
    const p = sanitizePack(raw)
    registerHomebrewProficiencies(p.languages, p.tools)
    registerHomebrewRaces(p.races.map(toRace), [])
    const id = p.races[0].id
    expect(allRaces('2024').some(r => r.id === id)).toBe(true)
    expect(allRaces('2014').some(r => r.id === id)).toBe(false)
    expect(allLanguages()).toContain('Seaspeak')
    expect(allTools()).toContain('Tide charts')
    expect(homebrewProficiencyText('tool', 'Tide charts')).toBeUndefined()

    const c = createCharacter({
      name: 'S', ownerId: 'u1', playerName: '', alignment: 'True Neutral', raceId: id, backgroundId: 'acolyte', rulesEdition: '2024',
      classes: [{ classId: 'wizard', level: 1 }], abilityMethod: 'standard',
      baseAbilities: { str: 10, dex: 14, con: 13, int: 15, wis: 12, cha: 8 }, freeAbilityBonuses: ['int', 'int', 'con'], chosenSkills: [],
    })
    c.traitChoices = { [`${id}:choice`]: 'ebb' }
    c.sizeChoice = 'Medium'
    const d = derive(c)
    expect(d.abilities.con).toBe(14) // background +1 only; the species' +2 CON is a 2014 thing
    expect(d.size).toBe('Medium')
    expect(derive({ ...c, sizeChoice: 'Large' }).size).toBe('Small') // not offered: species default
    expect(d.senses.darkvision).toBe(60)
    expect(d.speeds.swim).toBe(25)
    expect(d.defenses.immunities).toContain('cold')
    expect(d.defenses.resistances).not.toContain('cold') // immunity from the Ebb pick wins
    expect(d.traits.some(t => t.startsWith('Tide (Ebb'))).toBe(true)
    expect(d.armorClass).toEqual({ value: 15, source: 'Natural Armor' })
    expect(d.tools).toContain("Cook's utensils")
    expect(toolPickGroups(c)[0]).toMatchObject({ source: 'Shellkin', count: 1 })
    expect(toolPickGroups(c)[0].from).toContain('Tide charts')
    expect(raceProfile(c)).toMatchObject({ armor: ['light'], weapons: ['martial'] })
    registerHomebrewRaces([], [])
    registerHomebrewProficiencies([], [])
  })

  it('validates the lineage pick and names', () => {
    const base = sanitizePack(raw).races[0]
    expect(raceIssues(base)).toEqual([])
    expect(raceIssues({ ...base, choice: { name: '', options: [{ name: 'A', detail: '' }] } })).toHaveLength(2)
    expect(languageIssues({ id: '', name: ' ', kind: 'standard' })).toHaveLength(1)
    expect(toolIssues({ id: '', name: 'Dice', kind: 'gaming' })).toEqual([])
  })
})

describe('homebrew monsters', () => {
  it('keeps a monster through a share code, namespaces its id and lists it in the content library', async () => {
    const { blankMonster } = await import('../monsters/model')
    const { toMonster } = await import('./store')
    const { registerContentPack, loadKind, unregisterContentPack } = await import('../content')
    const { findMonsters } = await import('../dm/logic')
    const p: HomebrewPack = {
      ...pack(),
      monsters: [{
        ...blankMonster(), id: 'hb:other:bog-hag', name: 'Bog Hag', challengeRating: 3, xp: 700, legendary: { actions: 2 },
        actions: [{ name: 'Claw', description: 'Rakes.', attackBonus: 5, damage: [{ dice: '2d6+3', type: 'slashing' }] }],
        legendaryActions: [{ name: 'Cackle', description: 'DC 13 WIS or frightened.', damage: [], save: { ability: 'wis', dc: 13, onSuccess: 'none' } }],
        spellcasting: { ability: 'cha', saveDc: 13, groups: [{ label: 'At will', spells: ['Minor Illusion'] }] },
      }],
    }
    const back = decodePack(encodeShareCode(p))
    expect(back.monsters).toHaveLength(1)
    const hag = back.monsters[0]
    expect(hag.id).toBe('hb:abcd1234:bog-hag')
    expect(hag.actions[0].attackBonus).toBe(5)
    expect(hag.legendary).toEqual({ actions: 2 })
    expect(hag.spellcasting?.groups[0].spells).toEqual(['Minor Illusion'])
    expect(sanitizeEntry('monsters', { name: 'Restored', hitPointsRoll: '3d8' }, 'abcd1234')).toMatchObject({ id: 'hb:abcd1234:restored', hitPoints: 13 })

    const m = toMonster(hag, back.id)
    expect(m.source).toBe('hb:abcd1234')
    registerContentPack({ format: 'ff-content', version: 1, source: { id: m.source, title: back.name, edition: '2014', license: 'homebrew', attribution: 'x' }, entries: { monsters: [m] } })
    const all = await loadKind('monsters')
    expect(all.find(x => x.id === 'hb:abcd1234:bog-hag')?.name).toBe('Bog Hag')
    expect(findMonsters(all, { text: 'bog', minCr: 3, maxCr: 3, type: 'humanoid' })[0]?.source).toBe('hb:abcd1234')
    const { loadMonsters } = await import('../content')
    for (const ed of ['2014', '2024'] as const) expect((await loadMonsters(ed)).some(x => x.id === 'hb:abcd1234:bog-hag')).toBe(true)
    unregisterContentPack(m.source)
  })

  it('loads packs saved before monsters existed with none', () => {
    const { monsters: _drop, ...old } = pack()
    expect(sanitizePack(old).monsters).toEqual([])
  })
})
