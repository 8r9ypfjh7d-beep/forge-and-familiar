import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import {
  addClassIssues, createCharacter, derive, getArmorClass, getAttacks, getCasterLevel, getResources,
  getSpellSlots, getSpellcastingByClass, meetsPrereq, multiclassWarnings, prereqLabel, type CharacterDraft,
} from './index'

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test',
  ownerId: 'u1',
  playerName: '',
  alignment: 'True Neutral',
  raceId: 'human',
  backgroundId: 'acolyte',
  classes: [{ classId: 'fighter', level: 1 }],
  abilityMethod: 'manual',
  // Human +1 everywhere: 14 13 13 13 13 13.
  baseAbilities: { str: 13, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
  freeAbilityBonuses: [],
  chosenSkills: [],
  ...over,
})

const make = (classes: [string, number][], over: Partial<CharacterDraft> = {}, edit?: (c: Character) => void) => {
  const c = createCharacter(draft({ classes: classes.map(([classId, level]) => ({ classId, level })), ...over }))
  edit?.(c)
  return c
}

const equipOnly = (c: Character, ...ids: string[]) => {
  c.inventory = ids.map((itemId, i) => ({ uid: String(i), itemId, qty: 1, equipped: true }))
}

const scores = (over: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>>) =>
  ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...over })

describe('multiclass prerequisites', () => {
  it('labels and checks all/any requirements', () => {
    expect(prereqLabel('paladin')).toBe('STR 13 and CHA 13')
    expect(prereqLabel('fighter')).toBe('STR 13 or DEX 13')
    expect(meetsPrereq('fighter', scores({ dex: 13 }))).toBe(true)
    expect(meetsPrereq('fighter', scores({ wis: 13 }))).toBe(false)
    expect(meetsPrereq('monk', scores({ dex: 13, wis: 12 }))).toBe(false)
    expect(meetsPrereq('monk', scores({ dex: 13, wis: 13 }))).toBe(true)
  })

  it('checks the new class and every current class, using racial bonuses', () => {
    const base = { str: 13, dex: 10, con: 10, int: 10, wis: 10, cha: 12 }
    const fighter = draft({ raceId: 'dwarf', subraceId: 'hill-dwarf', baseAbilities: base })
    // Hill dwarf adds CON/WIS, not CHA: Paladin's CHA 13 is missing.
    expect(addClassIssues(fighter, 'paladin')).toEqual(['Paladin needs STR 13 and CHA 13.'])
    const human = draft({ baseAbilities: { ...base, str: 11 } })
    // Human +1: STR 12, CHA 13. Fighter itself is now unmet.
    expect(addClassIssues(human, 'sorcerer')).toEqual(['Fighter needs STR 13 or DEX 13.'])
    expect(addClassIssues(draft(), 'wizard')).toEqual([])
    expect(addClassIssues(draft(), 'fighter')).toEqual(['Already a Fighter.'])
    expect(addClassIssues(draft({ classes: [{ classId: 'fighter', level: 20 }] }), 'wizard')).toEqual(['Already at level 20.'])
  })

  it('warns on the sheet when a saved build breaks the rules', () => {
    const c = make([['fighter', 3], ['wizard', 2]], { baseAbilities: scores({ str: 14 }) })
    expect(derive(c).warnings).toContain('Multiclass prerequisite not met: Wizard needs INT 13.')
    expect(multiclassWarnings(make([['fighter', 5]], { baseAbilities: scores({}) }))).toEqual([])
  })
})

describe('multiclass proficiencies', () => {
  it('limits armor from a second class', () => {
    const wizFighter = make([['wizard', 1], ['fighter', 1]], {}, c => equipOnly(c, 'chain-mail'))
    expect(derive(wizFighter).warnings.some(w => w.startsWith('Not proficient with Chain Mail'))).toBe(true)
    const wizCleric = make([['wizard', 1], ['cleric', 1]], {}, c => equipOnly(c, 'scale-mail', 'shield'))
    expect(derive(wizCleric).warnings.some(w => w.startsWith('Not proficient'))).toBe(false)
    const fighterWiz = make([['fighter', 1], ['wizard', 1]], {}, c => equipOnly(c, 'chain-mail'))
    expect(derive(fighterWiz).warnings.some(w => w.startsWith('Not proficient'))).toBe(false)
  })

  it('limits weapons from a second class', () => {
    const wizRogue = make([['wizard', 1], ['rogue', 1]], {}, c => equipOnly(c, 'rapier'))
    expect(getAttacks(wizRogue)[0].proficient).toBe(false)
    const wizMonk = make([['wizard', 1], ['monk', 1]], {}, c => equipOnly(c, 'shortsword'))
    expect(getAttacks(wizMonk)[0].proficient).toBe(true)
  })
})

describe('features that do not stack', () => {
  it('keeps the first Unarmored Defense only', () => {
    const c = make([['barbarian', 1], ['monk', 1]], { baseAbilities: { str: 13, dex: 15, con: 11, int: 10, wis: 17, cha: 10 } }, c => equipOnly(c))
    // DEX 16 (+3), CON 12 (+1), WIS 18 (+4): Barbarian's 14, not Monk's 17.
    expect(getArmorClass(c)).toEqual({ value: 14, source: 'Unarmored Defense (Barbarian)' })
    expect(derive(c).warnings).toContain("Unarmored Defense from Barbarian and Monk doesn't stack: you only get it once.")
  })

  it('does not add Channel Divinity uses across classes', () => {
    const c = make([['cleric', 6], ['paladin', 3]], { baseAbilities: { str: 13, dex: 10, con: 10, int: 10, wis: 13, cha: 13 } })
    expect(getResources(c).find(r => r.id === 'channel-divinity')?.max).toBe(2)
    expect(derive(c).warnings).toContain('Channel Divinity from Cleric and Paladin adds options, not extra uses.')
  })

  it('flags Extra Attack from two classes', () => {
    const c = make([['fighter', 5], ['paladin', 5]], { baseAbilities: scores({ str: 13, cha: 13 }) })
    expect(derive(c).warnings).toContain("Extra Attack from Fighter and Paladin doesn't stack: you only get it once.")
  })
})

describe('multiclass spell slots', () => {
  it('explains the caster level', () => {
    expect(getCasterLevel(make([['wizard', 5], ['paladin', 4]])).explanation)
      .toBe('Wizard 5 + Paladin 4 ÷ 2 (round down) = caster level 7')
    expect(getCasterLevel(make([['paladin', 5], ['fighter', 2]])).explanation)
      .toBe('Paladin 5 ÷ 2 (round up) = caster level 3')
    expect(getCasterLevel(make([['fighter', 2]])).explanation).toBe('No spell slots.')
  })

  it('matches the SRD multiclass table', () => {
    expect(getSpellSlots(make([['wizard', 5], ['paladin', 4]])).slots.slice(0, 5)).toEqual([4, 3, 3, 1, 0])
    // Two half casters both round down: 1 + 1 = 2.
    expect(getSpellSlots(make([['paladin', 3], ['ranger', 3]])).slots.slice(0, 2)).toEqual([3, 0])
    // A lone half caster at level 1 multiclassed with a non-caster still has no slots.
    expect(getSpellSlots(make([['paladin', 1], ['fighter', 4]])).slots[0]).toBe(0)
  })

  it('keeps pact slots apart and gives each class its own DC', () => {
    const c = make([['sorcerer', 3], ['warlock', 2]], { baseAbilities: scores({ cha: 15 }) })
    expect(getSpellSlots(c)).toEqual({ slots: [4, 2, 0, 0, 0, 0, 0, 0, 0], pact: { level: 1, count: 2 } })
    const wizCleric = make([['wizard', 3], ['cleric', 2]], { baseAbilities: scores({ int: 15, wis: 13 }) })
    expect(getSpellcastingByClass(wizCleric).map(s => [s.className, s.saveDc])).toEqual([['Wizard', 14], ['Cleric', 13]])
    expect(derive(c).warnings.some(w => w.startsWith('Pact Magic slots are separate'))).toBe(true)
  })
})
