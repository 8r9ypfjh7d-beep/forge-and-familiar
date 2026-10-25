import { describe, expect, it } from 'vitest'
import { ITEMS } from '../rules'
import {
  BUNDLED, LIBRARY_ID_FOR_RULES_ITEM, checkContent, filterMonsters, filterSpells, fromHomebrewPack, getEntry, loadKind, registerContentPack,
  sanitizePack, searchEntries, toRulesItem, unregisterContentPack, type Equipment, type Spell,
} from './index'
import { characterClass, equipment, feat, magicItem, monster, normalizeAll, spell, text } from './ingest/fiveEBits'
import { SRD_51, SRD_52 } from './ingest/sources'

const c14 = { source: SRD_51 }
const c24 = { source: SRD_52 }
const school = { index: 'evocation', name: 'Evocation' }

describe('normalize 5e-bits', () => {
  it('joins paragraph arrays into markdown, keeping list items together', () => {
    expect(text(['Intro.', '- one', '- two', 'Outro.'])).toBe('Intro.\n\n- one\n- two\n\nOutro.')
    expect(text('  single string  ')).toBe('single string')
  })

  it('reads 2014 and 2024 spells into one shape', () => {
    const old = spell({
      index: 'fireball', name: 'Fireball', desc: ['Boom.'], higher_level: ['More boom.'], range: '150 feet', components: ['V', 'S', 'M'],
      material: 'Bat guano.', ritual: false, duration: 'Instantaneous', concentration: false, casting_time: '1 action', level: 3,
      damage: [{ damage_type: { index: 'fire' }, damage_at_slot_level: { 3: '8d6', 4: '9d6' } }],
      dc: { dc_type: { index: 'dex' }, dc_success: 'half' }, area_of_effect: { type: 'sphere', size: 20 },
      school, classes: [{ index: 'wizard' }], subclasses: [],
    }, c14)
    expect(old).toMatchObject({
      source: 'srd-5.1', edition: '2014', level: 3, description: 'Boom.', higherLevels: 'More boom.',
      components: { v: true, s: true, m: true, material: 'Bat guano.' }, save: { ability: 'dex', onSuccess: 'half' },
      damage: { type: 'fire', bySlotLevel: { 3: '8d6', 4: '9d6' } }, area: { shape: 'sphere', size: 20 }, classes: ['wizard'],
    })
    const cantrip = spell({
      index: 'fire-bolt', name: 'Fire Bolt', level: 0, school, classes: [], casting_time: 'Action', ritual: false, range: '120 feet',
      components: ['V', 'S'], duration: 'Instantaneous', concentration: false, attack_type: 'ranged',
      damage: { damage_type: { index: 'fire' }, damage_at_slot_level: { 0: '1d10' } }, description: 'Hurl fire.',
    }, c24)
    expect(cantrip.damage).toEqual({ type: 'fire', byCharacterLevel: { 1: '1d10' } })
    expect(cantrip).toMatchObject({ edition: '2024', attack: 'ranged', subclasses: [], description: 'Hurl fire.' })
  })

  it('reads weapons and armor from both category styles', () => {
    const bow14 = equipment({
      index: 'longbow', name: 'Longbow', equipment_category: { index: 'weapon' }, weapon_category: 'Martial', weapon_range: 'Ranged',
      category_range: 'Martial Ranged', cost: { quantity: 50, unit: 'gp' }, damage: { damage_dice: '1d8', damage_type: { index: 'piercing' } },
      range: { normal: 150, long: 600 }, weight: 2, properties: [{ index: 'ammunition' }, { index: 'two-handed' }],
    }, c14)
    expect(bow14).toMatchObject({ type: 'weapon', categories: ['martial-ranged-weapons', 'weapon'], cost: { qty: 50, unit: 'gp' } })
    expect(bow14.weapon).toEqual({ category: 'martial', range: 'ranged', properties: ['ammunition', 'two-handed'], damage: { dice: '1d8', type: 'piercing' }, normalRange: 150, longRange: 600 })

    const sword24 = equipment({
      index: 'longsword', name: 'Longsword', equipment_categories: [{ index: 'martial-melee-weapons' }, { index: 'martial-weapons' }, { index: 'weapons' }],
      cost: { quantity: 15, unit: 'gp' }, damage: { damage_dice: '1d8', damage_type: { index: 'slashing' } }, range: { normal: 5 }, weight: 3,
      properties: [{ index: 'versatile' }], mastery: { index: 'sap' }, two_handed_damage: { damage_dice: '1d10' },
    }, c24)
    expect(sword24.weapon).toMatchObject({ category: 'martial', range: 'melee', reach: 5, versatileDamage: '1d10', mastery: 'sap' })

    const plate24 = equipment({
      index: 'half-plate-armor', name: 'Half Plate', equipment_categories: [{ index: 'armor' }, { index: 'medium-armor' }],
      armor_class: { base: 15, dex_bonus: true, max_bonus: 2 }, stealth_disadvantage: true, weight: 40, cost: { quantity: 750, unit: 'gp' },
    }, c24)
    expect(plate24.armor).toEqual({ category: 'medium', baseAc: 15, dexBonus: true, maxDexBonus: 2, stealthDisadvantage: true })
  })

  it('reads attunement, rarity and variants of magic items', () => {
    const parents = new Map([['weapon-1', 'weapon']])
    const avenger = magicItem({ index: 'holy-avenger', name: 'Holy Avenger', equipment_category: { index: 'weapon' }, rarity: { name: 'Legendary' }, variants: [], desc: ['Weapon (any sword), legendary (requires attunement by a paladin)', 'Text.'] }, c14, parents)
    expect(avenger).toMatchObject({ rarity: 'legendary', attunement: 'a paladin' })
    const plus1 = magicItem({ index: 'weapon-1', name: 'Weapon, +1', equipment_category: { index: 'weapon' }, rarity: { name: 'Uncommon' }, variants: [], desc: ['Weapon (any), uncommon'] }, c14, parents)
    expect(plus1).toMatchObject({ attunement: false, variantOf: 'weapon' })
    const varies = magicItem({ index: 'armor', name: 'Armor +1/+2/+3', rarity: { name: 'Rare (+1), Very Rare (+2), or Legendary (+3)' }, variants: [{ index: 'armor-1', name: '+1' }], attunement: true, desc: 'Armor' }, c24, parents)
    expect(varies).toMatchObject({ rarity: 'varies', rarityText: 'Rare (+1), Very Rare (+2), or Legendary (+3)', attunement: true, variants: [{ id: 'armor-1', name: '+1' }] })
  })

  it('reads 2024 feat prerequisites, including "either ability" options', () => {
    const f = feat({
      index: 'grappler', name: 'Grappler', type: 'general', prerequisites: { minimum_level: 4 }, description: 'Grab.',
      prerequisite_options: { choose: 1, from: { options: [
        { option_type: 'score_prerequisite', ability_score: { index: 'str' }, minimum_score: 13 },
        { option_type: 'score_prerequisite', ability_score: { index: 'dex' }, minimum_score: 13 },
      ] } },
    }, c24)
    expect(f).toMatchObject({ category: 'general', prerequisites: { minimumLevel: 4, anyAbility: true, abilities: [{ ability: 'str', minimum: 13 }, { ability: 'dex', minimum: 13 }] } })
  })

  it('marks ASI levels from the running 2014 count', () => {
    const levels = [1, 2, 3, 4, 5].map(level => ({ level, prof_bonus: 2, features: [], class: { index: 'wizard' }, ability_score_bonuses: level >= 4 ? 1 : 0, class_specific: {} }))
    const wiz = characterClass({ index: 'wizard', name: 'Wizard', hit_die: 6, saving_throws: [{ index: 'int' }, { index: 'wis' }], proficiencies: [{ index: 'daggers', name: 'Daggers' }, { index: 'saving-throw-int', name: 'ST' }], multi_classing: { prerequisites: [{ ability_score: { index: 'int' }, minimum_score: 13 }] }, subclasses: [] }, c14, levels)
    expect(wiz.levels.filter(l => l.abilityScoreImprovement).map(l => l.level)).toEqual([4])
    expect(wiz).toMatchObject({ primaryAbilities: ['int'], proficiencies: [{ id: 'daggers', name: 'Daggers' }], multiclass: { anyOf: false } })
  })

  it('reads monster sizes, damage choices and usage', () => {
    const m = monster({
      index: 'x', name: 'X', size: 'Medium or Small', type: 'humanoid', alignment: 'any', armor_class: [{ type: 'armor', value: 15, armor: [{ name: 'Chain Shirt' }] }],
      hit_points: 11, hit_dice: '2d8', hit_points_roll: '2d8 + 2', speed: { walk: '30 ft.' }, strength: 10, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10,
      proficiencies: [{ value: 3, proficiency: { index: 'saving-throw-dex' } }, { value: 4, proficiency: { index: 'skill-stealth' } }],
      damage_vulnerabilities: [], damage_resistances: [], damage_immunities: ['poison'], condition_immunities: [{ index: 'poisoned', name: 'Poisoned' }],
      senses: { passive_perception: 10 }, languages: 'Common', challenge_rating: 0.25, xp: 50, proficiency_bonus: 2,
      actions: [{ name: 'Zap', desc: 'Zap.', attack_bonus: 4, damage: [{ choose: 1, from: { options: [{ damage_dice: '1d6', damage_type: { index: 'lightning' } }, { damage_dice: '1d6', damage_type: { index: 'thunder' } }] } }], usage: { type: 'recharge on roll', dice: '1d6', min_value: 5 } }],
    }, c14)
    expect(m).toMatchObject({
      sizes: ['Medium', 'Small'], hitPointsRoll: '2d8+2', armorClass: [{ value: 15, type: 'armor', note: 'Chain Shirt' }],
      savingThrows: { dex: 3 }, skills: { stealth: 4 }, damageImmunities: ['poison'], conditionImmunities: ['poisoned'],
    })
    expect(m.actions[0]).toMatchObject({ attackBonus: 4, damage: [], damageChoice: [{ dice: '1d6', type: 'lightning' }, { dice: '1d6', type: 'thunder' }], usage: { type: 'recharge', dice: '1d6', minimum: 5 } })
  })

  it('normalizeAll gives every kind, empty when upstream has no file', () => {
    const all = normalizeAll({ Conditions: [{ index: 'prone', name: 'Prone', desc: ['Down.'] }] }, SRD_51)
    expect(all.conditions).toEqual([{ id: 'prone', name: 'Prone', source: 'srd-5.1', edition: '2014', description: 'Down.' }])
    expect(all.spells).toEqual([])
  })
})

describe('checkContent', () => {
  it('reports duplicate ids and missing links', () => {
    const s = { id: 'a', name: 'A', source: 's', edition: '2014', classes: ['bard'] } as unknown as Spell
    expect(checkContent({ spells: [s, s] })).toEqual(['spells: duplicate id a', 'spell a → missing classes bard', 'spell a → missing classes bard'])
  })
})

describe('bundled SRD library', () => {
  it('ships SRD 5.1 and 5.2 with CC-BY attribution', () => {
    expect(BUNDLED.map(m => m.source.id)).toEqual(['srd-5.1', 'srd-5.2'])
    for (const m of BUNDLED) {
      expect(m.source.license).toBe('CC-BY-4.0')
      expect(m.source.attribution).toMatch(/Creative Commons Attribution 4\.0/)
    }
  })

  it('loads every kind lazily, with counts matching the manifest and no broken links', async () => {
    for (const m of BUNDLED) {
      const kinds = Object.keys(m.counts) as (keyof typeof m.counts)[]
      const content = Object.fromEntries(await Promise.all(kinds.map(async k => [k, await loadKind(k, { sources: [m.source.id] })])))
      for (const k of kinds) expect(content[k].length, `${m.source.id} ${k}`).toBe(m.counts[k])
      expect(checkContent(content)).toEqual([])
    }
  })

  it('filters by edition and finds entries by id', async () => {
    const spells14 = await loadKind('spells', { edition: '2014' })
    expect(spells14.length).toBeGreaterThan(300)
    expect(spells14.every(s => s.edition === '2014')).toBe(true)
    const fireball = await getEntry('spells', 'fireball', { edition: '2024' })
    expect(fireball).toMatchObject({ source: 'srd-5.2', level: 3, school: 'evocation' })
    expect(filterSpells(spells14, { levels: [0], classId: 'wizard' }).map(s => s.id)).toContain('fire-bolt')
    const dragons = filterMonsters(await loadKind('monsters', { edition: '2014' }), { types: ['dragon'], minCr: 20 })
    expect(dragons.map(d => d.id)).toContain('ancient-red-dragon')
  })

  it('agrees with the rules engine on every SRD 5.1 weapon and armor', async () => {
    const library = new Map((await loadKind('equipment', { sources: ['srd-5.1'] })).map(e => [e.id, e]))
    for (const item of ITEMS) {
      if (item.kind === 'gear') continue
      const e = library.get(LIBRARY_ID_FOR_RULES_ITEM[item.id] ?? item.id)
      expect(e, item.id).toBeDefined()
      const converted = toRulesItem(e!)!
      expect(converted.kind, item.id).toBe(item.kind)
      if (item.kind === 'weapon' && converted.kind === 'weapon') {
        expect(converted.damage, item.id).toBe(item.damage)
        expect(converted.versatile, item.id).toBe(item.versatile)
        expect([...converted.properties].sort(), item.id).toEqual([...item.properties].sort())
      }
      if (item.kind === 'armor' && converted.kind === 'armor') {
        expect(converted.baseAc, item.id).toBe(item.baseAc)
        expect(converted.dexCap, item.id).toBe(item.dexCap)
        expect(converted.strengthReq, item.id).toBe(item.strengthReq)
      }
    }
  })
})

describe('packs', () => {
  it('sanitizes imported packs and refuses to pose as the SRD', () => {
    expect(sanitizePack({ format: 'ff-content', version: 1, source: { id: 'srd-5.1', title: 'Fake' }, entries: {} })).toBeNull()
    expect(sanitizePack({ format: 'other' })).toBeNull()
    const pack = sanitizePack({
      format: 'ff-content', version: 1, source: { id: 'table-rules', title: 'Our table', edition: '2024' },
      entries: { spells: [{ id: 'zap', name: 'Zap', source: 'srd-5.1' }, { name: 'no id' }], bogus: [{ id: 'x', name: 'x' }] },
    })!
    expect(pack.source).toMatchObject({ id: 'table-rules', edition: '2024', license: 'unspecified' })
    expect(pack.entries.spells).toEqual([{ id: 'zap', name: 'Zap', source: 'table-rules', edition: '2024' }])
    expect(Object.keys(pack.entries)).toEqual(['spells'])
  })

  it('merges registered packs after the SRD and removes them again', async () => {
    const pack = sanitizePack({ format: 'ff-content', version: 1, source: { id: 'p', title: 'P' }, entries: { conditions: [{ id: 'bewildered', name: 'Bewildered', description: 'Huh.' }] } })!
    registerContentPack(pack)
    expect((await getEntry('conditions', 'bewildered'))?.source).toBe('p')
    expect((await loadKind('conditions', { sources: ['p'] })).length).toBe(1)
    unregisterContentPack('p')
    expect(await getEntry('conditions', 'bewildered')).toBeUndefined()
  })

  it('turns a homebrew pack into a content pack', () => {
    const pack = fromHomebrewPack({
      format: 'ff-homebrew', version: 1, id: 'abc123abc123', name: 'Frost', description: '', authorId: 'u', authorName: 'Dana', updatedAt: '',
      spells: [{ id: 'hb:abc123abc123:chill', name: 'Chill', level: 0, school: 'Evocation', castingTime: '1 action', range: '60 feet', components: { v: true, s: true, m: false }, duration: 'Instantaneous', concentration: false, ritual: false, classes: ['wizard'], description: 'Cold.', damage: '1d8', damageType: 'cold' }],
      items: [{ kind: 'weapon', id: 'hb:abc123abc123:frost-brand', name: 'Frost Brand', category: 'martial', damage: '1d10', damageType: 'cold', properties: ['versatile'], versatile: '1d12', weight: 3 }],
      feats: [], races: [], subclasses: [],
    })
    expect(pack.source).toMatchObject({ id: 'hb:abc123abc123', attribution: 'Homebrew by Dana' })
    expect(pack.entries.spells![0]).toMatchObject({ school: 'evocation', damage: { type: 'cold', byCharacterLevel: { 1: '1d8' } } })
    const brand = pack.entries.equipment![0] as Equipment
    expect(toRulesItem(brand)).toMatchObject({ kind: 'weapon', damage: '1d10', versatile: '1d12', properties: ['versatile'] })
  })
})

describe('search', () => {
  it('ranks name matches above description matches', () => {
    const mk = (id: string, name: string, description: string) => ({ id, name, description, source: 's', edition: '2014' as const })
    const list = [mk('a', 'Cone of Cold', 'A blast of fire-free cold.'), mk('b', 'Fire Shield', 'Flames.'), mk('c', 'Fire', 'x'), mk('d', 'Wall of Fire', 'y')]
    expect(searchEntries(list, 'fire').map(e => e.id)).toEqual(['c', 'b', 'd', 'a'])
    expect(searchEntries(list, '')).toBe(list)
  })
})
