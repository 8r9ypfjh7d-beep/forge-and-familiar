import { afterEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_SUBCLASS, addClassIssues, classById, classesFor, createCharacter, derive, getCasterLevel, getProficiencies, getSpellSlots, registerHomebrewClasses,
  registerHomebrewSubclasses, subclassSpellNames, type CharacterDraft,
} from '../rules'
import { stepIssues, subclassSlots } from '../builder/validate'
import { spellAccess } from '../spellbook/access'
import { blankClass, classIssues, classWarnings, parseSteps, sanitizeEntry, sanitizePack } from './pack'
import { toClass } from './store'
import type { HomebrewClass } from './types'

const runeSmith = (over: Partial<HomebrewClass> = {}): HomebrewClass => ({
  ...blankClass(),
  id: 'hb:abcd1234:rune-smith', name: 'Rune Smith', hitDie: 10, primary: ['int'], savingThrows: ['con', 'int'],
  skillChoices: { count: 2, from: ['arcana', 'history', 'athletics'] }, armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'],
  tools: ["Smith's tools"], caster: 'third', spellAbility: 'int',
  spellcasting: { list: 'wizard', kind: 'known', cantrips: [[3, 2], [10, 3]], known: [[3, 3], [4, 4], [7, 5]] },
  subclassLevel: 3, subclassTitle: 'Forge Tradition',
  features: [
    { level: 1, name: 'Rune Carving', text: 'Carve a rune.', uses: { count: 0, recharge: 'short', steps: [[1, 2], [5, 3]] } },
    { level: 2, name: 'Forge Sight', effects: [{ kind: 'sense', sense: 'darkvision', value: 60 }, { kind: 'resistance', damage: 'fire' }] },
    { level: 3, name: 'Hammer Rhythm', uses: { count: 'int', recharge: 'long', add: 1 } },
    { level: 9, name: 'Later', effects: [{ kind: 'ac', value: 1 }] },
  ],
  multiclass: { prereq: { int: 13, str: 13 }, armor: ['light'], weapons: ['simple'] },
  ...over,
})

const draft = (classes: CharacterDraft['classes'], over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'T', ownerId: 'u1', playerName: '', alignment: 'True Neutral', raceId: 'human', backgroundId: 'acolyte', classes,
  abilityMethod: 'standard', baseAbilities: { str: 12, dex: 14, con: 14, int: 15, wis: 10, cha: 8 }, freeAbilityBonuses: [], chosenSkills: [],
  ...over,
})

afterEach(() => registerHomebrewClasses([]))

describe('homebrew classes in packs', () => {
  it('sanitizes a shared class field by field', () => {
    const pack = sanitizePack({
      format: 'ff-homebrew', version: 1, id: 'abcd1234', name: 'Book', updatedAt: '2026-10-25T00:00:00Z',
      classes: [{
        id: 'wizard', name: 'Rune Smith', hitDie: 7, savingThrows: ['con', 'luck', 'con'], caster: 'quarter', spellAbility: 'int',
        skillChoices: { count: 99, from: ['arcana', 'flying'] }, asiLevels: [19, 4, 4, 40],
        features: [{ level: 1, name: 'Rune', uses: { count: 'pb', recharge: 'dawn', steps: [[5, 3], [1, 2], 'x'] }, effects: [{ kind: 'sense', sense: 'darkvision', value: 60 }, { kind: 'nope' }] }],
        multiclass: { prereq: { int: 13, luck: 18 }, armor: ['light', 'mithral'] },
      }, { name: 'Caster', caster: 'full', spellcasting: { list: 'wizard', kind: 'known', known: [[1, 2]] } }],
    })
    const [c, caster] = pack.classes
    expect(c).toMatchObject({
      id: 'hb:abcd1234:rune-smith', hitDie: 8, savingThrows: ['con'], caster: 'none', spellAbility: undefined, spellcasting: undefined,
      skillChoices: { count: 18, from: ['arcana'] }, asiLevels: [4, 19, 20], subclassTitle: 'Subclass',
      multiclass: { prereq: { int: 13 }, armor: ['light'], weapons: [] },
    })
    expect(c.features[0]).toEqual({
      level: 1, name: 'Rune', uses: { count: 'pb', recharge: 'long', steps: [[1, 2], [5, 3]] }, effects: [{ kind: 'sense', sense: 'darkvision', value: 60 }],
    })
    expect(caster.spellcasting).toEqual({ list: 'wizard', kind: 'known', cantrips: [], known: [[1, 2]] })
    expect(sanitizePack({ format: 'ff-homebrew', version: 1, id: 'abcd1234' }).classes).toEqual([])
    expect(sanitizeEntry('classes', runeSmith(), 'abcd1234')).toEqual(runeSmith())
  })

  it('blocks only what it needs and warns about the rest', () => {
    expect(classIssues(runeSmith())).toEqual([])
    expect(classIssues(runeSmith({ name: ' ', spellAbility: undefined }))).toHaveLength(2)
    expect(classWarnings(runeSmith()).map(w => w.key)).toEqual([])
    expect(classWarnings(runeSmith({ savingThrows: ['con'], skillChoices: { count: 4, from: ['arcana'] }, features: [] })).map(w => w.key))
      .toEqual(['hb.cls.warn.saves', 'hb.cls.warn.skills', 'hb.cls.warn.noFeatures'])
  })

  it('reads level steps typed as text', () => {
    expect(parseSteps('4:3, 1:2;10=4, junk')).toEqual([[1, 2], [4, 3], [10, 4]])
  })
})

describe('homebrew classes in the rules engine', () => {
  it('lists a registered class in both editions, never over an official id', () => {
    registerHomebrewClasses([toClass(runeSmith()), toClass(runeSmith({ id: 'fighter', name: 'Fake' }))])
    expect(classesFor('2014').at(-1)?.id).toBe('hb:abcd1234:rune-smith')
    expect(classById('hb:abcd1234:rune-smith', '2024')?.toolProficiencies).toEqual(["Smith's tools"])
    expect(classById('fighter')?.name).toBe('Fighter')
  })

  it('derives hit points, saves, resources, feature effects and one-third casting', () => {
    registerHomebrewClasses([toClass(runeSmith())])
    const c = createCharacter(draft([{ classId: 'hb:abcd1234:rune-smith', level: 5 }]))
    const s = derive(c)
    // Human: every score +1, so CON 15 (+2) and INT 16 (+3).
    expect(s.maxHp).toBe(10 + 2 + 4 * (6 + 2))
    expect(s.hitDice).toEqual([{ die: 'd10', total: 5 }])
    expect(s.saves.con.proficient && s.saves.int.proficient && !s.saves.str.proficient).toBe(true)
    expect(s.resources.find(r => r.label === 'Rune Carving')).toMatchObject({ id: 'class:hb:abcd1234:rune-smith:rune-carving', max: 3, recharge: 'short' })
    expect(s.resources.find(r => r.label === 'Hammer Rhythm')?.max).toBe(4)
    expect(s.senses.darkvision).toBe(60)
    expect(s.defenses.resistances).toEqual(['fire'])
    expect(s.features.find(f => f.name === 'Rune Carving')?.text).toBe('Carve a rune.')
    expect(s.features.some(f => f.name === 'Later')).toBe(false)
    expect(s.spellcasting?.ability).toBe('int')
    // One-third caster 5 = caster level 2 on its own: three 1st-level slots.
    expect(getCasterLevel(c).casterLevel).toBe(2)
    expect(getSpellSlots(c).slots.slice(0, 2)).toEqual([3, 0])
  })

  it('applies unarmored defense and the multiclass rules the class sets', () => {
    registerHomebrewClasses([toClass(runeSmith({ unarmoredDefense: 'int', armor: [] }))])
    const solo = createCharacter(draft([{ classId: 'hb:abcd1234:rune-smith', level: 1 }]))
    expect(derive(solo).armorClass.value).toBe(10 + 2 + 3)

    const wizard = draft([{ classId: 'wizard', level: 3 }])
    expect(addClassIssues(wizard, 'hb:abcd1234:rune-smith')).toEqual([])
    expect(addClassIssues({ ...wizard, baseAbilities: { ...wizard.baseAbilities, str: 8 } }, 'hb:abcd1234:rune-smith')).toEqual(['Rune Smith needs INT 13 and STR 13.'])
    const both = { ...wizard, classes: [...wizard.classes, { classId: 'hb:abcd1234:rune-smith', level: 3 }] }
    const profs = getProficiencies(both)
    expect([...profs.armor]).toEqual(['light'])
    // Wizard 3 + one-third caster 3 (rounded down when multiclassed) = caster level 4.
    expect(getCasterLevel(both).casterLevel).toBe(4)
  })

  it('gives the spellbook its own known spells, cantrips and borrowed list', () => {
    registerHomebrewClasses([toClass(runeSmith())])
    const scores = { str: 13, dex: 15, con: 15, int: 16, wis: 11, cha: 9 }
    const [a] = spellAccess({ classes: [{ classId: 'hb:abcd1234:rune-smith', level: 7 }] }, [], [], scores)
    expect(a).toMatchObject({ className: 'Rune Smith', ability: 'int', maxLevel: 2, cantrips: 2, kind: 'known', limit: 5, listClassId: 'wizard' })
    registerHomebrewClasses([toClass(runeSmith({ caster: 'full', spellcasting: { list: '', kind: 'prepared', cantrips: [], known: [] } }))])
    const [b] = spellAccess({ classes: [{ classId: 'hb:abcd1234:rune-smith', level: 5 }] }, [], [], scores)
    expect(b).toMatchObject({ maxLevel: 3, cantrips: 0, kind: 'prepared', limit: 3 + 5 })
    expect(b.listClassId).toBeUndefined()
  })
})

describe('subclasses for homebrew classes', () => {
  it('a homebrew class with no listed subclasses still gets a subclass slot, with Custom', () => {
    registerHomebrewClasses([toClass(runeSmith())])
    const id = 'hb:abcd1234:rune-smith'
    expect(subclassSlots(draft([{ classId: id, level: 2 }]))).toEqual([])
    expect(subclassSlots(draft([{ classId: id, level: 3 }]))).toHaveLength(1)
    expect(stepIssues('class', draft([{ classId: id, level: 3 }]))).toContain('Choose the Forge Tradition for your Rune Smith.')
    const custom = draft([{ classId: id, level: 3, subclassId: CUSTOM_SUBCLASS }], {
      customSubclasses: [{ classId: id, name: 'Ember Rites', features: [{ level: 3, name: 'Ember', uses: { count: 2, recharge: 'long' } }] }],
    })
    expect(stepIssues('class', custom)).toEqual([])
    expect(derive(createCharacter(custom)).resources.find(r => r.label === 'Ember')).toMatchObject({ id: `sub:custom:${id}:ember`, max: 2 })
  })
})

describe('homebrew pack subclasses', () => {
  afterEach(() => registerHomebrewSubclasses([]))
  const raw = {
    format: 'ff-homebrew', version: 1, id: 'abcd1234', name: 'Oaths',
    subclasses: [{
      name: 'Oath of Embers', classId: 'paladin', armor: ['heavy'], weapons: ['martial', 'laser'], hpPerLevel: 9, unarmoredAbility: 'cha', castingWeapon: 'yes',
      spells: [{ level: 3, names: ['Burning Hands', 42, ''] }, { level: 5, names: [] }],
      features: [{
        level: 3, name: 'Kindle', text: 'Light a flame.', uses: { count: 'pb', recharge: 'short', add: 1 },
        effects: [{ kind: 'resistance', damage: 'fire' }, { kind: 'nonsense' }],
      }],
    }],
  }

  it('keeps text, uses, effects, spells and proficiencies, cleaned', () => {
    const sc = sanitizePack(raw).subclasses[0]
    expect(sc).toMatchObject({
      id: 'hb:abcd1234:oath-of-embers', armor: ['heavy'], weapons: ['martial'], hpPerLevel: 5, unarmoredAbility: 'cha',
      spells: [{ level: 3, names: ['Burning Hands'] }],
      features: [{ level: 3, name: 'Kindle', text: 'Light a flame.', uses: { count: 'pb', recharge: 'short', add: 1 }, effects: [{ kind: 'resistance', damage: 'fire' }] }],
    })
    expect(sc.castingWeapon).toBeUndefined()
  })

  it('works on the sheet', () => {
    registerHomebrewSubclasses(sanitizePack(raw).subclasses)
    const c = createCharacter(draft([{ classId: 'paladin', level: 5, subclassId: 'hb:abcd1234:oath-of-embers' }]))
    const d = derive(c)
    expect(d.defenses.resistances).toContain('fire')
    expect(d.features.find(f => f.name === 'Kindle')?.text).toBe('Light a flame.')
    expect(d.resources.find(r => r.label === 'Kindle')).toMatchObject({ id: 'sub:hb:abcd1234:oath-of-embers:kindle', max: 4, recharge: 'short' })
    expect([...getProficiencies(c).armor]).toContain('heavy')
    expect(subclassSpellNames(c, 'paladin')).toEqual(['Burning Hands'])
  })
})
