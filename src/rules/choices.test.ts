import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import {
  BACKGROUNDS, CLASSES, ITEMS, SUBCLASSES, allRaces, anyFilter, classKit, createCharacter, derive, getAbilityScores,
  getArmorClass, getMaxHp, improvementSlots, itemById, raceById, registerHomebrewFeats, registerHomebrewRaces,
  registerHomebrewSubclasses, startingItemIds, subclassesFor, type CharacterDraft,
} from './index'

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'fighter', level: 1 }],
  abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  freeAbilityBonuses: [], chosenSkills: ['athletics', 'perception'],
  ...over,
})

const make = (over: Partial<CharacterDraft> = {}, edit?: (c: Character) => void) => {
  const c = createCharacter(draft(over))
  edit?.(c)
  return c
}

describe('SRD content coverage', () => {
  it('has the SRD subclass first for every class, chosen at the right level', () => {
    for (const c of CLASSES) {
      expect(subclassesFor(c.id)[0], c.id).toBe(SUBCLASSES.find(s => s.classId === c.id))
      expect([1, 2, 3]).toContain(c.subclassLevel)
    }
    expect(SUBCLASSES).toHaveLength(12)
  })

  it('every kit and background item exists', () => {
    for (const c of CLASSES) {
      for (const id of [...c.startingEquipment, ...(c.equipmentChoices ?? []).flatMap(ch => ch.options.flatMap(o => o.items))]) {
        expect(anyFilter(id) || itemById(id), `${c.id}: ${id}`).toBeTruthy()
      }
    }
    for (const b of BACKGROUNDS) for (const id of b.equipment) expect(itemById(id), id).toBeTruthy()
  })

  it('has every SRD weapon except the net', () => {
    expect(ITEMS.filter(i => i.kind === 'weapon')).toHaveLength(36)
  })
})

describe('Ability Score Improvements', () => {
  it('lists slots per class, including fighter and rogue extras', () => {
    expect(improvementSlots({ classes: [{ classId: 'fighter', level: 8 }] }).map(s => s.level)).toEqual([4, 6, 8])
    expect(improvementSlots({ classes: [{ classId: 'rogue', level: 10 }, { classId: 'wizard', level: 4 }] })).toEqual([
      { classId: 'rogue', level: 4 }, { classId: 'rogue', level: 8 }, { classId: 'rogue', level: 10 }, { classId: 'wizard', level: 4 },
    ])
  })

  it('adds to scores, caps at 20, and ignores slots above the current level', () => {
    const d = draft({ classes: [{ classId: 'fighter', level: 4 }], improvements: [{ classId: 'fighter', level: 4, abilities: { str: 2 } }] })
    expect(getAbilityScores(d).str).toBe(18) // 15 + human 1 + 2
    expect(getAbilityScores({ ...d, baseAbilities: { ...d.baseAbilities, str: 19 } }).str).toBe(20)
    expect(getAbilityScores({ ...d, classes: [{ classId: 'fighter', level: 3 }] }).str).toBe(16)
  })

  it('applies feat effects from homebrew feats', () => {
    registerHomebrewFeats([{
      id: 'hb:p:quick', name: 'Quick', description: '', effects: [
        { kind: 'ability', ability: 'dex', amount: 1 }, { kind: 'initiative', amount: 5 }, { kind: 'speed', amount: 10 },
        { kind: 'skill', skill: 'stealth' }, { kind: 'hpPerLevel', amount: 2 },
      ],
    }])
    const c = make({ classes: [{ classId: 'fighter', level: 4 }], improvements: [{ classId: 'fighter', level: 4, featId: 'hb:p:quick' }] })
    const d = derive(c)
    expect(d.abilities.dex).toBe(16)
    expect(d.initiative).toBe(3 + 5)
    expect(d.speed).toBe(40)
    expect(d.skills.stealth.proficient).toBe(true)
    expect(d.feats).toEqual(['Quick'])
    expect(getMaxHp(c)).toBe(12 + 3 * 8 + 4 * 2) // d10 + CON 2, then 6 + 2 per level, +2 per level from the feat
    registerHomebrewFeats([])
  })
})

describe('languages, tools and traits', () => {
  it('combines race, background and class languages with picks', () => {
    const d = derive(make({ classes: [{ classId: 'rogue', level: 1 }], chosenLanguages: ['Elvish', 'Orc', 'Giant'] }))
    expect(d.languages).toEqual(['Common', "Thieves' Cant", 'Elvish', 'Orc', 'Giant'])
    expect(d.tools).toEqual(["Thieves' tools"])
  })

  it('shows the dragonborn ancestry in traits', () => {
    const d = derive(make({ raceId: 'dragonborn', traitChoices: { draconicAncestry: 'red' } }))
    expect(d.traits[0]).toBe('Draconic Ancestry (Red: Fire, 15 ft. cone (DEX save))')
  })
})

describe('custom background', () => {
  it('grants its skills, tools and languages', () => {
    const d = derive(make({
      backgroundId: 'custom', chosenLanguages: [],
      customBackground: { name: 'Sage', feature: 'Researcher', skills: ['arcana', 'history'], tools: [], languages: ['Draconic', 'Giant'] },
    }))
    expect(d.skills.arcana.proficient).toBe(true)
    expect(d.skills.religion.proficient).toBe(false)
    expect(d.languages).toEqual(['Common', 'Draconic', 'Giant'])
  })

  it('adds no background items', () => {
    const ids = startingItemIds(draft({ backgroundId: 'custom', customBackground: { name: 'X', feature: '', skills: [], tools: [], languages: [] } }))
    expect(ids).not.toContain('prayer-book')
  })
})

describe('starting equipment choices', () => {
  const fighter = CLASSES.find(c => c.id === 'fighter')!
  it('defaults to the first option and fills "any" slots', () => {
    expect(classKit(fighter)).toEqual(['chain-mail', 'longsword', 'shield', 'light-crossbow', 'bolts', 'dungeoneers-pack'])
  })

  it('uses the picked options and items, ignoring invalid picks', () => {
    const picks = [{ option: 1, items: [] }, { option: 1, items: ['greatsword', 'dagger'] }, { option: 1, items: [] }, { option: 1, items: [] }]
    expect(classKit(fighter, picks)).toEqual(['leather', 'longbow', 'arrows', 'greatsword', 'longsword', 'handaxe', 'handaxe', 'explorers-pack'])
  })
})

describe('subclass mechanics', () => {
  it('Life Domain grants heavy armor proficiency', () => {
    const plate = (c: Character) => { c.inventory = [{ uid: '1', itemId: 'chain-mail', qty: 1, equipped: true }] }
    const warn = (sub?: string) => derive(make({ classes: [{ classId: 'cleric', level: 1, subclassId: sub }], baseAbilities: { str: 15, dex: 10, con: 13, int: 8, wis: 14, cha: 12 } }, plate)).warnings
    expect(warn().some(w => w.startsWith('Not proficient'))).toBe(true)
    expect(warn('life').some(w => w.startsWith('Not proficient'))).toBe(false)
  })

  it('Draconic Bloodline adds HP per level and 13 + DEX unarmored', () => {
    const c = make({ classes: [{ classId: 'sorcerer', level: 3, subclassId: 'draconic' }] }, x => { x.inventory = [] })
    const plain = make({ classes: [{ classId: 'sorcerer', level: 3 }] }, x => { x.inventory = [] })
    expect(getMaxHp(c) - getMaxHp(plain)).toBe(3)
    expect(getArmorClass(c)).toEqual({ value: 13 + 2, source: 'Draconic Bloodline' })
  })

  it('lists subclass features up to the class level', () => {
    const d = derive(make({ classes: [{ classId: 'fighter', level: 3, subclassId: 'champion' }] }))
    expect(d.features.map(f => f.name)).toContain('Improved Critical')
    expect(d.features.map(f => f.name)).not.toContain('Remarkable Athlete')
  })
})

describe('homebrew races and subclasses', () => {
  it('attaches homebrew subraces and adds homebrew races', () => {
    registerHomebrewRaces(
      [{ id: 'hb:p:tabaxi', name: 'Tabaxi', size: 'Medium', speed: 30, abilityBonuses: { dex: 2, cha: 1 }, languages: ['Common'], languageChoices: 1, traits: ['Darkvision'] }],
      [{ id: 'hb:p:wood-elf', name: 'Wood Elf', parentRaceId: 'elf', abilityBonuses: { wis: 1 }, traits: ['Fleet of Foot'] }],
    )
    expect(allRaces().map(r => r.id)).toContain('hb:p:tabaxi')
    expect(raceById('elf')?.subraces?.map(s => s.id).at(-1)).toBe('hb:p:wood-elf')
    expect(getAbilityScores(draft({ raceId: 'elf', subraceId: 'hb:p:wood-elf' })).wis).toBe(11)
    const official = raceById('elf')!.subraces!.length - 1
    registerHomebrewRaces([], [])
    expect(raceById('elf')?.subraces).toHaveLength(official)
  })

  it('offers homebrew subclasses for their class', () => {
    registerHomebrewSubclasses([{ id: 'hb:p:battle-master', classId: 'fighter', name: 'Battle Master', features: [{ level: 3, name: 'Combat Superiority' }] }])
    const ids = subclassesFor('fighter').map(s => s.id)
    expect(ids[0]).toBe('champion')
    expect(ids.at(-1)).toBe('hb:p:battle-master')
    const d = derive(make({ classes: [{ classId: 'fighter', level: 3, subclassId: 'hb:p:battle-master' }] }))
    expect(d.features.map(f => f.name)).toContain('Combat Superiority')
    registerHomebrewSubclasses([])
  })
})
