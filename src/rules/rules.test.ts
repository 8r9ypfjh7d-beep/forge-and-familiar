import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import {
  abilityMod, createCharacter, derive, getCritRange, getDamageRiders, getAbilityScores, getArmorClass, getAttacks, getMaxHp,
  getResources, getSpellSlots, pointBuyCost, assignRolled, usesRolledPool, ROLLED_NOTATION, type CharacterDraft,
} from './index'

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test',
  ownerId: 'u1',
  playerName: '',
  alignment: 'True Neutral',
  raceId: 'human',
  backgroundId: 'acolyte',
  classes: [{ classId: 'fighter', level: 1 }],
  abilityMethod: 'standard',
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  freeAbilityBonuses: [],
  chosenSkills: ['athletics', 'perception'],
  ...over,
})

const make = (over: Partial<CharacterDraft> = {}, edit?: (c: Character) => void) => {
  const c = createCharacter(draft(over))
  edit?.(c)
  return c
}

const equipOnly = (c: Character, ...ids: string[]) => {
  c.inventory = ids.map((itemId, i) => ({ uid: String(i), itemId, qty: 1, equipped: true }))
}

describe('abilities', () => {
  it('computes modifiers', () => {
    expect([1, 8, 9, 10, 11, 15, 20].map(abilityMod)).toEqual([-5, -1, -1, 0, 0, 2, 5])
  })

  it('prices point buy and rejects out-of-range scores', () => {
    expect(pointBuyCost({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })).toBe(27)
    expect(pointBuyCost({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBeNull()
  })

  it('assigns rolled scores from the pool, swapping when every copy is taken', () => {
    const pool = [16, 12, 12, 9, 14, 7]
    const zero = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
    let b = assignRolled(zero, pool, 'str', 12)
    b = assignRolled(b, pool, 'dex', 12)
    expect([b.str, b.dex]).toEqual([12, 12])
    b = assignRolled({ ...b, con: 16 }, pool, 'int', 16)
    expect([b.con, b.int]).toEqual([0, 16])
    const full = { str: 16, dex: 14, con: 12, int: 12, wis: 9, cha: 7 }
    expect(usesRolledPool(full, pool)).toBe(true)
    expect(usesRolledPool({ ...full, cha: 12 }, pool)).toBe(false)
    expect(ROLLED_NOTATION).toBe('4d6dl1')
  })

  it('applies race, subrace and half-elf free bonuses', () => {
    expect(getAbilityScores(make({ raceId: 'dwarf', subraceId: 'hill-dwarf' }))).toMatchObject({ con: 15, wis: 11 })
    const he = make({ raceId: 'half-elf', freeAbilityBonuses: ['str', 'cha', 'dex'] })
    // Only two picks count; CHA is off the book's list but allowed (the builder warns).
    expect(getAbilityScores(he)).toMatchObject({ str: 16, dex: 14, cha: 11 })
    // Moved racial bonuses: the hill dwarf's +2 CON goes to STR, the +1 WIS stays.
    const moved = make({ raceId: 'dwarf', subraceId: 'hill-dwarf', racialBonusTargets: ['str'] })
    expect(getAbilityScores(moved)).toMatchObject({ str: 17, con: 13, wis: 11 })
  })
})

describe('hit points', () => {
  it('uses max die at 1st level and average after', () => {
    // Human fighter, CON 14 (+2): 10+2, then 4 × (6+2)
    expect(getMaxHp(make({ classes: [{ classId: 'fighter', level: 5 }] }))).toBe(44)
  })

  it('adds hill dwarf toughness per level', () => {
    // CON 13+2 = 15 (+2): wizard 6+2+1, then 4+2+1
    expect(getMaxHp(make({ raceId: 'dwarf', subraceId: 'hill-dwarf', classes: [{ classId: 'wizard', level: 2 }] }))).toBe(16)
  })

  it('starts the character at full HP', () => {
    const c = make()
    expect(c.state.currentHp).toBe(getMaxHp(c))
  })
})

describe('armor class', () => {
  it('caps DEX for medium armor and ignores it for heavy', () => {
    const c = make({ baseAbilities: { str: 15, dex: 18, con: 13, int: 8, wis: 8, cha: 8 } })
    equipOnly(c, 'breastplate')
    expect(getArmorClass(c).value).toBe(16)
    equipOnly(c, 'plate', 'shield')
    expect(getArmorClass(c).value).toBe(20)
  })

  it('uses barbarian and monk unarmored defense', () => {
    const scores = { str: 10, dex: 15, con: 15, int: 8, wis: 15, cha: 8 }
    const barb = make({ classes: [{ classId: 'barbarian', level: 1 }], baseAbilities: scores }, c => equipOnly(c, 'shield'))
    expect(getArmorClass(barb).value).toBe(10 + 3 + 3 + 2)
    const monk = make({ classes: [{ classId: 'monk', level: 1 }], baseAbilities: scores }, c => equipOnly(c))
    expect(getArmorClass(monk).value).toBe(16)
    equipOnly(monk, 'shield')
    expect(getArmorClass(monk).value).toBe(10 + 3 + 2)
  })

  it('equips the starting kit (fighter: chain mail + shield)', () => {
    expect(getArmorClass(make()).value).toBe(18)
  })
})

describe('attacks', () => {
  it('uses the better of STR and DEX for finesse weapons', () => {
    const c = make({ baseAbilities: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 } }, ch => equipOnly(ch, 'rapier'))
    const rapier = getAttacks(c)[0]
    // Human DEX 16+1 = 17 (+3)
    expect(rapier).toMatchObject({ ability: 'dex', bonus: 3 + 2, damage: '1d8+3' })
  })

  it('drops proficiency for unproficient weapons', () => {
    const c = make({ classes: [{ classId: 'wizard', level: 1 }] }, ch => equipOnly(ch, 'greatsword'))
    expect(getAttacks(c)[0]).toMatchObject({ proficient: false, bonus: 3 })
  })

  it('carries versatile damage and properties', () => {
    const c = make({}, ch => equipOnly(ch, 'longsword'))
    expect(getAttacks(c)[0]).toMatchObject({ damage: '1d8+3', versatile: '1d10+3', properties: ['versatile'] })
  })

  it('offers Rage on STR melee and Sneak Attack on finesse or ranged', () => {
    const rapier = { ability: 'dex' as const, properties: ['finesse'] }
    const axe = { ability: 'str' as const, properties: ['heavy', 'two-handed'] }
    expect(getDamageRiders({ classes: [{ classId: 'barbarian', level: 9 }] }, axe)).toEqual([{ id: 'rage', name: 'Rage', damage: '+3' }])
    expect(getDamageRiders({ classes: [{ classId: 'barbarian', level: 9 }] }, rapier)).toEqual([])
    expect(getDamageRiders({ classes: [{ classId: 'rogue', level: 5 }] }, rapier)[0]).toMatchObject({ id: 'sneakAttack', damage: '3d6' })
    expect(getDamageRiders({ classes: [{ classId: 'rogue', level: 5 }] }, axe)).toEqual([])
  })

  it('widens the crit range for a Champion', () => {
    expect(getCritRange({ classes: [{ classId: 'fighter', level: 3, subclassId: 'champion' }] })).toBe(19)
    expect(getCritRange({ classes: [{ classId: 'fighter', level: 15, subclassId: 'champion' }] })).toBe(18)
    expect(getCritRange({ classes: [{ classId: 'fighter', level: 5 }] })).toBe(20)
  })
})

describe('spellcasting and resources', () => {
  it('gives full and half caster slots', () => {
    expect(getSpellSlots(make({ classes: [{ classId: 'wizard', level: 5 }] })).slots.slice(0, 3)).toEqual([4, 3, 2])
    expect(getSpellSlots(make({ classes: [{ classId: 'paladin', level: 1 }] })).slots[0]).toBe(0)
    expect(getSpellSlots(make({ classes: [{ classId: 'paladin', level: 5 }] })).slots.slice(0, 2)).toEqual([4, 2])
  })

  it('gives warlock pact slots', () => {
    expect(getSpellSlots(make({ classes: [{ classId: 'warlock', level: 5 }] })).pact).toEqual({ level: 3, count: 2 })
  })

  it('scales resources and switches recharge with level', () => {
    const bard1 = getResources(make({ classes: [{ classId: 'bard', level: 1 }] }))
    expect(bard1[0]).toMatchObject({ id: 'bardic-inspiration', recharge: 'long' })
    const bard5 = getResources(make({ classes: [{ classId: 'bard', level: 5 }] }))
    expect(bard5[0].recharge).toBe('short')
    expect(getResources(make({ classes: [{ classId: 'monk', level: 1 }] }))).toEqual([])
    expect(getResources(make({ classes: [{ classId: 'monk', level: 6 }] }))[0]).toMatchObject({ id: 'ki', max: 6 })
  })
})

describe('derive', () => {
  it('combines skills from class, race and background', () => {
    const d = derive(make({ raceId: 'elf', subraceId: 'high-elf' }))
    // athletics + perception chosen, perception from elf, insight + religion from acolyte
    expect(Object.entries(d.skills).filter(([, s]) => s.proficient).map(([k]) => k).sort())
      .toEqual(['athletics', 'insight', 'perception', 'religion'])
    expect(d.passivePerception).toBe(10 + 0 + 2)
  })

  it('applies proficiency to class saves only', () => {
    const d = derive(make())
    expect(d.saves.str).toEqual({ bonus: 3 + 2, proficient: true })
    expect(d.saves.dex.proficient).toBe(false)
  })

  it('reduces speed for heavy armor without the strength', () => {
    const c = make({ baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }, ch => equipOnly(ch, 'plate'))
    expect(derive(c).speed).toBe(20)
  })
})

describe('roll mode', () => {
  it('applies conditions', async () => {
    const { getRollMode, autoFailsSave } = await import('./index')
    const c = make({}, ch => { ch.state.conditions = ['poisoned'] })
    expect(getRollMode(c, 'attack')).toBe('disadvantage')
    expect(getRollMode(c, 'save', 'con')).toBe('normal')
    c.state.conditions = ['poisoned', 'invisible']
    expect(getRollMode(c, 'attack')).toBe('normal')
    c.state.conditions = ['stunned']
    expect(autoFailsSave(c, 'dex')).toBe(true)
  })
})

describe('homebrew items', () => {
  it('lets derive() use registered homebrew weapons', async () => {
    const { registerHomebrewItems, getAttacks } = await import('./index')
    registerHomebrewItems([{ kind: 'weapon', id: 'hb:p1:frost-brand', name: 'Frost Brand', category: 'martial', damage: '1d10', damageType: 'cold', properties: [], weight: 3 }])
    const c = make({}, ch => equipOnly(ch, 'hb:p1:frost-brand'))
    expect(getAttacks(c)[0]).toMatchObject({ name: 'Frost Brand', damage: '1d10+3', proficient: true })
    registerHomebrewItems([])
  })
})
