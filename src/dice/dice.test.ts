import { describe, expect, it } from 'vitest'
import { createCharacter, derive, type CharacterDraft } from '../rules'
import {
  critNotation, DiceNotationError, parseNotation, roll, rollAttack, rollD20, rollAttackWithDamage, rollDamage, rollDeathSave,
  rollHitDie, rollSave, rollSkill, RollHistory, type HistoryStorage, type RollResult, type Rng,
} from './index'

/** Returns the given values in order, then repeats the last one. */
const seq = (...values: number[]): Rng => {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

const fighter = () => {
  const draft: CharacterDraft = {
    name: 'Bruna',
    ownerId: 'u1',
    playerName: 'Ziv',
    alignment: 'True Neutral',
    raceId: 'human',
    backgroundId: 'acolyte',
    classes: [{ classId: 'fighter', level: 1 }],
    abilityMethod: 'standard',
    baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    freeAbilityBonuses: [],
    chosenSkills: ['athletics', 'perception'],
  }
  return createCharacter(draft)
}

describe('notation', () => {
  it('parses dice, constants and keep/drop', () => {
    expect(parseNotation('2d6+3')).toEqual([
      { kind: 'dice', sign: 1, count: 2, sides: 6 },
      { kind: 'const', sign: 1, value: 3 },
    ])
    expect(parseNotation('d%')[0]).toMatchObject({ count: 1, sides: 100 })
    expect(parseNotation('4d6dl1')[0]).toMatchObject({ keep: { type: 'dl', n: 1 } })
    expect(parseNotation(' 1D8 − 1 ')).toEqual([
      { kind: 'dice', sign: 1, count: 1, sides: 8 },
      { kind: 'const', sign: -1, value: 1 },
    ])
  })

  it('rejects bad input', () => {
    for (const bad of ['', 'abc', '2d', 'd0', '1000d6', '2d6+', '2d20kh3', '2d6dl2', '1d6**2']) {
      expect(() => parseNotation(bad), bad).toThrow(DiceNotationError)
    }
  })

  it('doubles dice on a crit, not modifiers', () => {
    expect(critNotation('1d8+3')).toBe('2d8+3')
    expect(critNotation('2d6−1')).toBe('4d6-1')
  })
})

describe('roll', () => {
  it('sums dice and modifiers', () => {
    const r = roll('2d6+3', { rng: seq(4, 5) })
    expect(r.total).toBe(12)
    expect(r.breakdown).toBe('[4, 5] + 3')
    expect(r.notation).toBe('2d6+3')
  })

  it('handles negative terms', () => {
    expect(roll('1d10-1d4-2', { rng: seq(7, 3) }).total).toBe(2)
  })

  it('keeps and drops dice', () => {
    const r = roll('4d6dl1', { rng: seq(3, 1, 6, 5) })
    expect(r.total).toBe(14)
    expect(r.breakdown).toBe('[3, ~~1~~, 6, 5]')
  })

  it('every die face can come up with the default rng', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) seen.add(roll('1d4').total)
    expect([...seen].sort()).toEqual([1, 2, 3, 4])
  })
})

describe('d20 rolls', () => {
  it('advantage keeps the higher die and flags crits', () => {
    const r = rollD20(5, { mode: 'advantage', rng: seq(20, 3) })
    expect(r.total).toBe(25)
    expect(r.d20).toEqual({ mode: 'advantage', natural: 20, crit: true, fumble: false })
  })

  it('disadvantage keeps the lower die', () => {
    const r = rollD20(-1, { mode: 'disadvantage', rng: seq(1, 15) })
    expect(r.total).toBe(0)
    expect(r.d20?.fumble).toBe(true)
    expect(r.breakdown).toBe('[1, ~~15~~] − 1')
  })

  it('advantage and disadvantage cancel out', () => {
    const r = rollD20(0, { mode: ['advantage', 'disadvantage', 'advantage'], rng: seq(9) })
    expect(r.d20?.mode).toBe('normal')
    expect(r.terms[0]).toMatchObject({ rolls: [{ value: 9 }] })
  })
})

describe('character rolls', () => {
  it('uses derived bonuses and labels', () => {
    const c = fighter()
    const stats = derive(c)
    const save = rollSave(stats, 'str', { rng: seq(10) })
    expect(save.total).toBe(10 + stats.saves.str.bonus)
    expect(save.label).toBe('STR save')
    const skill = rollSkill(stats, 'perception', { rng: seq(10), character: c })
    expect(skill.total).toBe(10 + stats.skills.perception.bonus)
    expect(skill.roller).toEqual({ characterId: c.id, characterName: 'Bruna' })
  })

  it("applies the character's conditions unless told not to", () => {
    const c = fighter()
    c.state.conditions = ['poisoned']
    const stats = derive(c)
    expect(rollSkill(stats, 'athletics', { character: c, rng: seq(5, 15) }).d20?.mode).toBe('disadvantage')
    expect(rollSkill(stats, 'athletics', { character: c, mode: 'advantage', rng: seq(5) }).d20?.mode).toBe('normal')
    expect(rollSkill(stats, 'athletics', { character: c, ignoreConditions: true, rng: seq(5) }).d20?.mode).toBe('normal')
  })

  it('flags automatic save failures', () => {
    const c = fighter()
    c.state.conditions = ['stunned']
    expect(rollSave(derive(c), 'dex', { character: c, rng: seq(20) }).autoFail).toBe(true)
    expect(rollSave(derive(c), 'wis', { character: c, rng: seq(20) }).autoFail).toBeUndefined()
  })

  it('rolls attacks and crit damage', () => {
    const attack = { name: 'Longsword', bonus: 5, damage: '1d8+3', damageType: 'slashing' }
    const hit = rollAttack(attack, { rng: seq(20) })
    expect(hit.d20?.crit).toBe(true)
    const dmg = rollDamage(attack, { crit: hit.d20!.crit, rng: seq(6, 2) })
    expect(dmg.notation).toBe('2d8+3')
    expect(dmg.total).toBe(11)
    expect(dmg.label).toBe('Longsword slashing (crit)')
  })

  it('handles flat unarmed damage and the engine minus sign', () => {
    expect(rollDamage({ name: 'Unarmed Strike', damage: '3', damageType: 'bludgeoning' }, { crit: true }).total).toBe(3)
    expect(rollDamage({ name: 'Dagger', damage: '1d4−1', damageType: 'piercing' }, { rng: seq(1) }).total).toBe(0)
  })

  it('hit dice never heal below 0 and death saves follow the SRD', () => {
    expect(rollHitDie('d6', -2, { rng: seq(1) }).total).toBe(0)
    expect(rollDeathSave({ rng: seq(20) }).outcome).toBe('regainOneHp')
    expect(rollDeathSave({ rng: seq(1) }).outcome).toBe('twoFailures')
    expect(rollDeathSave({ rng: seq(10) }).outcome).toBe('success')
    expect(rollDeathSave({ rng: seq(9) }).outcome).toBe('failure')
  })
})

describe('history', () => {
  it('keeps newest first, caps its size and persists', () => {
    let saved: RollResult[] = []
    const storage: HistoryStorage = { load: () => saved, save: r => (saved = r) }
    const h = new RollHistory(2, storage)
    let calls = 0
    h.subscribe(() => calls++)
    const a = h.add(roll('1d4', { rng: seq(1) }))
    const b = h.add(roll('1d4', { rng: seq(2), roller: { characterId: 'x', characterName: 'X' } }))
    const c = h.add(roll('1d4', { rng: seq(3) }))
    expect(h.all().map(r => r.id)).toEqual([c.id, b.id])
    expect(h.all()).not.toContain(a)
    expect(h.forCharacter('x')).toEqual([b])
    expect(calls).toBe(3)
    expect(new RollHistory(2, storage).all()).toHaveLength(2)
  })
})

describe('one-tap attack', () => {
  const sword = { name: 'Longsword', bonus: 5, damage: '1d8+3', damageType: 'slashing', versatile: '1d10+3' }

  it('rolls to hit and damage together', () => {
    const { attack, damage } = rollAttackWithDamage(sword, { rng: seq(12, 6) })
    expect(attack.total).toBe(17)
    expect(damage).toMatchObject({ notation: '1d8+3', total: 9, label: 'Longsword slashing' })
  })

  it('adds riders and two-handed damage, and doubles every die on a crit', () => {
    const riders = [{ name: 'Rage', damage: '+2' }, { name: 'Sneak Attack', damage: '2d6' }]
    const { damage } = rollAttackWithDamage(sword, { twoHanded: true, riders, rng: seq(20, 1) })
    expect(damage?.notation).toBe('2d10+3+2+4d6')
    expect(damage?.total).toBe(6 + 3 + 2) // six dice showing 1
    expect(damage?.label).toBe('Longsword slashing + Rage, Sneak Attack (crit)')
  })

  it('crits on 19 with a wider crit range and skips damage on a natural 1', () => {
    expect(rollAttackWithDamage(sword, { critRange: 19, rng: seq(19, 1) }).damage?.notation).toBe('2d8+3')
    expect(rollAttackWithDamage(sword, { rng: seq(1) }).damage).toBeUndefined()
  })

  it('applies the character\'s conditions to the attack', () => {
    const c = fighter()
    c.state.conditions = ['poisoned']
    expect(rollAttackWithDamage(sword, { character: c, rng: seq(15, 4, 3) }).attack.d20?.mode).toBe('disadvantage')
  })
})
