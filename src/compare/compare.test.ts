import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import {
  applyTweak, attacksPerAction, averageDamage, compareBuilds, damagePerRound, expectedHit, featureDiff, hitChance,
} from './compare'

const fighter4 = (overrides = {}) => makeCharacter({
  classes: [{ classId: 'fighter', level: 4 }],
  inventory: [
    { uid: 'a', itemId: 'longsword', qty: 1, equipped: true },
    { uid: 'b', itemId: 'chain-mail', qty: 1, equipped: true },
  ],
  ...overrides,
})

describe('damage math', () => {
  it('averages dice and flat modifiers', () => {
    expect(averageDamage('1d8+3')).toEqual({ dice: 4.5, flat: 3 })
    expect(averageDamage('2d6−1')).toEqual({ dice: 7, flat: -1 })
    expect(averageDamage('4')).toEqual({ dice: 0, flat: 4 })
  })

  it('keeps hit chance between a natural 1 and a natural 20', () => {
    expect(hitChance(5, 15)).toBeCloseTo(0.55)
    expect(hitChance(20, 10)).toBe(0.95)
    expect(hitChance(0, 30)).toBe(0.05)
  })

  it('counts critical hits as doubled dice', () => {
    // +5 vs AC 15: 55% for 7.5, plus 5% for another 4.5
    expect(expectedHit({ bonus: 5, damage: '1d8+3' }, 15)).toBeCloseTo(0.55 * 7.5 + 0.05 * 4.5)
  })

  it('gives Extra Attack at 5 and more Fighter attacks at 11 and 20', () => {
    expect(attacksPerAction(fighter4())).toBe(1)
    expect(attacksPerAction(fighter4({ classes: [{ classId: 'fighter', level: 5 }] }))).toBe(2)
    expect(attacksPerAction(fighter4({ classes: [{ classId: 'fighter', level: 11 }] }))).toBe(3)
    expect(attacksPerAction(fighter4({ classes: [{ classId: 'fighter', level: 20 }] }))).toBe(4)
    expect(attacksPerAction(fighter4({ classes: [{ classId: 'wizard', level: 9 }] }))).toBe(1)
  })

  it('adds Sneak Attack once per round for rogues', () => {
    const rogue = fighter4({ classes: [{ classId: 'rogue', level: 3 }] })
    const plain = damagePerRound(fighter4({ classes: [{ classId: 'fighter', level: 3 }] }), 15)
    const sneaky = damagePerRound(rogue, 15)
    expect(sneaky.notes.join()).toContain('2d6')
    expect(sneaky.perRound).toBeGreaterThan(plain.perRound)
  })
})

describe('applyTweak', () => {
  it('adds a level to an existing class or starts a multiclass', () => {
    const c = fighter4()
    expect(applyTweak(c, { levelClassId: 'fighter' }).classes).toEqual([{ classId: 'fighter', level: 5 }])
    expect(applyTweak(c, { levelClassId: 'wizard' }).classes).toEqual([
      { classId: 'fighter', level: 4 }, { classId: 'wizard', level: 1 },
    ])
    expect(c.classes).toEqual([{ classId: 'fighter', level: 4 }])
  })

  it('stops at level 20 and ignores unknown classes', () => {
    const c = fighter4({ classes: [{ classId: 'fighter', level: 20 }] })
    expect(applyTweak(c, { levelClassId: 'fighter' }).classes[0].level).toBe(20)
    expect(applyTweak(fighter4(), { levelClassId: 'nope' }).classes).toHaveLength(1)
  })

  it('applies +2 to one ability or +1 to two', () => {
    const c = fighter4()
    expect(applyTweak(c, { asi: ['str', 'str'] }).baseAbilities.str).toBe(c.baseAbilities.str + 2)
    const split = applyTweak(c, { asi: ['dex', 'con'] }).baseAbilities
    expect([split.dex, split.con]).toEqual([c.baseAbilities.dex + 1, c.baseAbilities.con + 1])
  })

  it('ignores exhaustion so builds compare at full strength', () => {
    const tired = fighter4()
    tired.state.exhaustion = 5
    expect(compareBuilds(applyTweak(tired, {}), fighter4())[0].rows.find(r => r.label === 'Speed')?.delta).toBe(0)
  })
})

describe('compareBuilds', () => {
  it('shows what a Fighter 5 level-up gains over a Wizard dip', () => {
    const base = fighter4()
    const fighter = applyTweak(base, { levelClassId: 'fighter' })
    const wizard = applyTweak(base, { levelClassId: 'wizard' })
    const rows = compareBuilds(fighter, wizard).flatMap(s => s.rows)
    const row = (label: string) => rows.find(r => r.label.startsWith(label))!

    expect(row('Attacks per action')).toMatchObject({ a: '2', b: '1', better: 'a' })
    expect(row('Damage per round').better).toBe('a')
    expect(row('Max HP').better).toBe('a')
    expect(row('Total slots')).toMatchObject({ delta: 2, better: 'b' })
    expect(row('Level').delta).toBe(0)
    expect(row('Spell save DC')).toMatchObject({ a: '—', b: '13', delta: null, better: 'b' })
  })

  it('hides empty sections and lists features unique to each side', () => {
    const base = fighter4()
    const sections = compareBuilds(base, base)
    expect(sections.map(s => s.title)).not.toContain('Skills that differ')
    expect(sections.flatMap(s => s.rows).every(r => r.better === null)).toBe(true)

    const diff = featureDiff(base, applyTweak(base, { levelClassId: 'fighter' }))
    expect(diff.onlyA).toEqual([])
    expect(diff.onlyB).toContain('Extra Attack (Fighter 5)')
  })
})
