import { describe, expect, it } from 'vitest'
import { stepIssues } from '../builder/validate'
import { he } from '../i18n/locales/he'
import { spellAccess } from '../spellbook/access'
import {
  BOOK_SUBCLASSES, BOOK_SUBCLASSES_2024, CUSTOM_SUBCLASS, createCharacter, derive, getProficiencies, getResources, subclassById, subclassesFor,
  subclassSpellNames, type CharacterDraft,
} from './index'

const warlock = (level: number, subclassId: string, over: Partial<CharacterDraft> = {}) => createCharacter({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'warlock', level, subclassId }],
  abilityMethod: 'manual', baseAbilities: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 16 },
  freeAbilityBonuses: [], chosenSkills: ['arcana', 'deception'],
  ...over,
})

describe('warlock patrons from every book', () => {
  it('offers the SRD Fiend first, then every other patron, in both editions', () => {
    expect(subclassesFor('warlock').map(s => s.id)).toEqual([
      'fiend', 'archfey', 'great-old-one', 'celestial', 'hexblade', 'fathomless', 'genie-dao', 'genie-djinni', 'genie-efreeti', 'genie-marid', 'undying', 'undead',
    ])
    expect(subclassesFor('warlock', '2024').map(s => s.id)).toEqual([
      'fiend-patron', 'archfey-patron', 'celestial-patron', 'great-old-one-patron', 'hexblade', 'fathomless', 'genie-dao', 'genie-djinni', 'genie-efreeti', 'genie-marid', 'undying', 'undead',
    ])
  })

  it('names every book subclass in Hebrew and says which book it is from', () => {
    for (const s of [...BOOK_SUBCLASSES, ...BOOK_SUBCLASSES_2024]) {
      expect(he.terms, s.id).toHaveProperty([`subclass.${s.id}`])
      expect(s.source, s.id).toBeTruthy()
    }
  })

  it('moves 2014-only patrons\' level 1 features to level 3 under 2024 rules', () => {
    expect(subclassById('hexblade')!.features[0].level).toBe(1)
    expect(subclassById('hexblade', '2024')!.features.every(f => f.level >= 3)).toBe(true)
    expect(subclassById('hexblade', '2024')!.spells![0].level).toBe(3)
  })

  it('applies resistances, immunities and speeds from the level they come in', () => {
    expect(derive(warlock(9, 'great-old-one')).defenses.resistances).toEqual([])
    expect(derive(warlock(10, 'great-old-one')).defenses.resistances).toEqual(['psychic'])
    expect(derive(warlock(10, 'archfey')).defenses.conditionImmunities).toEqual(['charmed'])
    expect(derive(warlock(1, 'fathomless')).speeds.swim).toBe(40)
    expect(derive(warlock(6, 'genie-efreeti')).defenses.resistances).toEqual(['fire'])
    expect(derive(warlock(10, 'great-old-one-patron', { rulesEdition: '2024' })).defenses.resistances).toEqual(['psychic'])
  })

  it('tracks patron feature uses on the sheet', () => {
    const celestial = getResources(warlock(5, 'celestial')).find(r => r.label === 'Healing Light')
    expect(celestial).toMatchObject({ max: 6, recharge: 'long' })
    expect(getResources(warlock(1, 'fathomless')).find(r => r.label === 'Tentacle of the Deeps')?.max).toBe(2)
    expect(getResources(warlock(1, 'hexblade')).find(r => r.label === "Hexblade's Curse")).toMatchObject({ max: 1, recharge: 'short' })
    // 2024 Steps of the Fey: CHA modifier uses.
    expect(getResources(warlock(3, 'archfey-patron', { rulesEdition: '2024' })).find(r => r.label === 'Steps of the Fey')?.max).toBe(3)
    // SRD Fiend now tracks its own uses too.
    expect(getResources(warlock(14, 'fiend')).map(r => r.label)).toEqual(expect.arrayContaining(["Dark One's Own Luck", 'Hurl Through Hell']))
  })

  it('offers the Heroes of Faerûn subclasses under 2024 rules in place of the ones they rewrote', () => {
    const ids = BOOK_SUBCLASSES_2024.map(s => s.id)
    expect(ids).toEqual(expect.arrayContaining(['college-of-the-moon', 'knowledge-domain', 'banneret', 'oath-of-the-noble-genies', 'winter-walker', 'scion-of-the-three', 'spellfire-sorcery', 'bladesinger']))
    expect(ids.filter(id => ['knowledge', 'purple-dragon-knight', 'bladesinging'].includes(id))).toEqual([])
    expect(BOOK_SUBCLASSES.map(s => s.id)).not.toContain('spellfire-sorcery')
    expect(subclassById('spellfire-sorcery', '2024')!.spells!.find(s => s.level === 6)!.names).toEqual(['Counterspell'])
  })

  it('gives the Hexblade martial weapons, medium armor, shields and Charisma pact attacks', () => {
    const c = warlock(1, 'hexblade')
    const p = getProficiencies(c)
    expect([...p.armor]).toEqual(expect.arrayContaining(['light', 'medium', 'shield']))
    expect([...p.weapons]).toContain('martial')
    c.inventory.push({ uid: 'w', itemId: 'longsword', qty: 1, equipped: true, pact: true })
    const sword = derive(c).attacks.find(a => a.name === 'Longsword')!
    expect(sword.bonus).toBe(3 + 2)
  })

  it('adds patron spells as always prepared, by level, resolving names in the spell library', () => {
    expect(subclassSpellNames(warlock(3, 'archfey'), 'warlock')).toEqual(['Faerie Fire', 'Sleep', 'Calm Emotions', 'Phantasmal Force'])
    const c = warlock(1, 'celestial')
    const classes = [{ id: 'warlock', name: 'Warlock', spellcasting: { ability: 'cha', fromLevel: 1 }, levels: [{ level: 1, spellcasting: { slots: [1], cantripsKnown: 2, spellsKnown: 2 } }] }]
    const spells = [{ id: 'cure-wounds', name: 'Cure Wounds' }, { id: 'light', name: 'Light' }]
    const [a] = spellAccess(c, classes as never, [], derive(c).abilities, undefined, spells)
    expect(a.alwaysPrepared.sort()).toEqual(['cure-wounds', 'light'])
  })
})

describe('custom subclass', () => {
  const custom = (level: number, name = 'The Raven Queen') => warlock(level, CUSTOM_SUBCLASS, {
    customSubclasses: [{
      classId: 'warlock', name,
      armor: ['medium'], hpPerLevel: 1,
      spells: [{ level: 1, names: ['Bane'] }, { level: 5, names: ['Speak with Dead'] }],
      features: [
        { level: 1, name: 'Sentinel Raven', text: 'A raven watches over you.', uses: { count: 'pb', recharge: 'long' }, effects: [{ kind: 'sense', sense: 'darkvision', value: 60 }] },
        { level: 6, name: 'Soul of the Raven', effects: [{ kind: 'resistance', damage: 'necrotic' }, { kind: 'skillProficiency', skill: 'perception' }] },
      ],
    }],
  })

  it('works on the sheet like an official one', () => {
    const low = derive(custom(1))
    expect(low.senses.darkvision).toBe(60)
    expect(low.defenses.resistances).toEqual([])
    expect(low.features.find(f => f.name === 'Sentinel Raven')?.text).toBe('A raven watches over you.')
    expect(low.resources.find(r => r.label === 'Sentinel Raven')?.max).toBe(2)
    expect(low.maxHp).toBe(derive(warlock(1, 'fiend')).maxHp + 1)
    expect([...getProficiencies(custom(1)).armor]).toContain('medium')
    const high = derive(custom(6))
    expect(high.defenses.resistances).toEqual(['necrotic'])
    expect(high.skills.perception.proficient).toBe(true)
    expect(subclassSpellNames(custom(6), 'warlock')).toEqual(['Bane', 'Speak with Dead'])
  })

  it('needs a name before leaving the class step', () => {
    expect(stepIssues('class', custom(1, ' '))).toContain('Give your custom Otherworldly Patron a name.')
    expect(stepIssues('class', custom(1))).toEqual([])
  })
})

describe('book subclasses for every class', () => {
  const hero = (classId: string, level: number, subclassId: string, over: Partial<CharacterDraft> = {}) => warlock(level, subclassId, {
    classes: [{ classId, level, subclassId }], chosenSkills: [], ...over,
  })

  it('gives each subclass a unique id per edition and covers every class', () => {
    for (const list of [BOOK_SUBCLASSES, BOOK_SUBCLASSES_2024]) {
      const ids = list.map(s => `${s.classId}:${s.id}`)
      expect(new Set(ids).size).toBe(ids.length)
      expect(new Set(list.map(s => s.classId)).size).toBe(13)
    }
  })

  it('scales feature uses with level and proficiency', () => {
    const dice = (lvl: number) => getResources(hero('fighter', lvl, 'battle-master')).find(r => r.label === 'Combat Superiority')?.max
    expect([dice(3), dice(7), dice(15)]).toEqual([4, 5, 6])
    expect(getResources(hero('fighter', 5, 'psi-warrior')).find(r => r.label === 'Psionic Power')?.max).toBe(6)
  })

  it('applies senses, proficiencies and resistances from other classes\' subclasses', () => {
    expect(derive(hero('cleric', 1, 'twilight')).senses.darkvision).toBe(300)
    expect([...getProficiencies(hero('bard', 3, 'valor')).armor]).toEqual(expect.arrayContaining(['medium', 'shield']))
    expect(derive(hero('cleric', 16, 'war')).defenses.resistances).toEqual([])
    expect(derive(hero('cleric', 17, 'war')).defenses.resistances).toEqual(expect.arrayContaining(['bludgeoning', 'piercing', 'slashing']))
  })
})
