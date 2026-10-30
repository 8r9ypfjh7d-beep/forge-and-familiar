import { afterEach, describe, expect, it } from 'vitest'
import {
  classChoices, classOptionById, classOptions, createCharacter, derive, getResources, registerClassOptions, type CharacterDraft,
} from './index'

const fighter = (level: number, over: Partial<CharacterDraft> = {}) => createCharacter({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'fighter', level }],
  abilityMethod: 'manual', baseAbilities: { str: 16, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
  freeAbilityBonuses: [], chosenSkills: ['athletics', 'perception'],
  ...over,
})

afterEach(() => {
  registerClassOptions('test', [])
  registerClassOptions('homebrew', [])
})

describe('class option registry', () => {
  it('lists official options before homebrew and filters by edition', () => {
    registerClassOptions('homebrew', [{ id: 'hb:p:mine', kind: 'maneuver', name: 'Mine' }])
    registerClassOptions('test', [
      { id: 'trip', kind: 'maneuver', name: 'Trip 2014', edition: '2014' },
      { id: 'trip', kind: 'maneuver', name: 'Trip 2024', edition: '2024' },
      { id: 'agonizing', kind: 'invocation', name: 'Agonizing' },
    ])
    expect(classOptions('maneuver', '2014').map(o => o.name)).toEqual(['Trip 2014', 'Mine'])
    expect(classOptions('maneuver').map(o => o.name)).toEqual(['Trip 2014', 'Trip 2024', 'Mine'])
    expect(classOptionById('trip', '2024')?.name).toBe('Trip 2024')
    expect(classOptionById('hb:p:mine', '2024')?.name).toBe('Mine')
  })

  it('applies picked effects, later effects, spells and uses to the sheet', () => {
    registerClassOptions('homebrew', [{
      id: 'hb:p:style', kind: 'fightingStyle', name: 'Iron Hide',
      effects: [{ kind: 'ac', value: 1, armored: true }],
      later: [{ level: 6, effects: [{ kind: 'resistance', damage: 'fire' }] }],
      spells: [{ name: 'Shield', level: 3 }],
      uses: { count: 'pb', recharge: 'long' },
    }])
    const pick = { classOptions: [{ kind: 'fightingStyle', id: 'hb:p:style', classId: 'fighter' }] }
    const low = fighter(2, pick)
    const high = fighter(6, pick)
    const mail = [{ uid: 'a', itemId: 'chain-mail', qty: 1, equipped: true }]
    expect(derive({ ...low, inventory: [] }).armorClass.value).toBe(12) // no armor worn, so the armored bonus waits
    expect(derive({ ...low, inventory: mail }).armorClass.value).toBe(17)
    expect(derive(high).defenses.resistances).toContain('fire')
    expect(derive(low).defenses.resistances).not.toContain('fire')
    expect(getResources(high).find(r => r.id === 'opt:hb:p:style')).toMatchObject({ max: 3, recharge: 'long' })
  })

  it('ignores picks whose option is gone', () => {
    expect(getResources(fighter(3, { classOptions: [{ kind: 'maneuver', id: 'hb:gone:x' }] }))).toEqual(getResources(fighter(3)))
  })

  it('adds homebrew fighting styles to the Fighting Style choice and applies the one picked', () => {
    registerClassOptions('homebrew', [
      { id: 'hb:p:wall', kind: 'fightingStyle', name: 'Shield Wall', text: 'Hold the line.', classIds: ['fighter'], effects: [{ kind: 'save', ability: 'str', value: 1 }] },
      { id: 'hb:p:old', kind: 'fightingStyle', name: 'Old Style', edition: '2014', classIds: ['fighter'] },
      { id: 'hb:p:pal', kind: 'fightingStyle', name: 'Oathguard', classIds: ['paladin'] },
    ])
    const c = fighter(1, { rulesEdition: '2024', featureChoices: { 'fighter.fightingStyle': 'hb:p:wall' } })
    const style = classChoices(c).find(x => x.choice.id === 'fightingStyle')!
    expect(style.choice.options.map(o => o.id)).toContain('hb:p:wall')
    expect(style.choice.options.map(o => o.id)).not.toContain('hb:p:old')
    expect(style.choice.options.map(o => o.id)).not.toContain('hb:p:pal')
    expect(style.picked?.name).toBe('Shield Wall')
    expect(derive(c).saves.str.bonus).toBe(derive(fighter(1, { rulesEdition: '2024' })).saves.str.bonus + 1)
  })
})
