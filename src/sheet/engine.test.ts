import { describe, expect, it } from 'vitest'
import { getMaxHp, getResources } from '../rules'
import {
  canLongRest, grantTempHp, heal, hitDiceRemaining, longRest, rollDeathSave,
  setPactUsed, setResourceUsed, setSlotUsed, shortRest, spendHitDie, stabilize,
  takeDamage, upsertCounter, vitals, dawn, dawnCounters, hitDieAverage, hitDicePreview,
} from './engine'
import { makeCharacter } from './fixtures'

const fighter = makeCharacter()
const MAX = getMaxHp(fighter)
const atZero = takeDamage(fighter, MAX)

describe('hit points', () => {
  it('starts at max HP', () => {
    expect(fighter.state.currentHp).toBe(MAX)
  })

  it('temp HP absorbs damage first', () => {
    const c = takeDamage(grantTempHp(fighter, 5), 8)
    expect(c.state.tempHp).toBe(0)
    expect(c.state.currentHp).toBe(MAX - 3)
  })

  it('temp HP does not stack, the higher value wins', () => {
    expect(grantTempHp(grantTempHp(fighter, 8), 5).state.tempHp).toBe(8)
    expect(grantTempHp(grantTempHp(fighter, 8), 5, { replace: true }).state.tempHp).toBe(5)
  })

  it('healing at full HP changes nothing, so it adds no history entry', () => {
    expect(heal(fighter, 5)).toBe(fighter)
  })

  it('healing caps at max HP', () => {
    expect(heal(takeDamage(fighter, 4), 100).state.currentHp).toBe(MAX)
  })

  it('drops to 0 and starts dying', () => {
    expect(atZero.state.currentHp).toBe(0)
    expect(vitals(atZero)).toBe('dying')
  })

  it('massive damage kills outright', () => {
    expect(vitals(takeDamage(fighter, MAX * 2))).toBe('dead')
    expect(vitals(takeDamage(fighter, MAX * 2 - 1))).toBe('dying')
  })
})

describe('death saves', () => {
  it('counts successes and failures, 3 successes is stable', () => {
    let c = rollDeathSave(atZero, 12)
    c = rollDeathSave(c, 4)
    expect(c.state.deathSaves).toEqual({ successes: 1, failures: 1 })
    c = rollDeathSave(rollDeathSave(c, 10), 15)
    expect(vitals(c)).toBe('stable')
  })

  it('a natural 1 is two failures, three failures is dead', () => {
    const c = rollDeathSave(rollDeathSave(atZero, 1), 5)
    expect(vitals(c)).toBe('dead')
  })

  it('a natural 20 regains 1 HP', () => {
    const c = rollDeathSave(atZero, 20)
    expect(c.state.currentHp).toBe(1)
    expect(vitals(c)).toBe('healthy')
  })

  it('damage at 0 HP is a failure, a crit is two', () => {
    expect(takeDamage(atZero, 1).state.deathSaves.failures).toBe(1)
    expect(takeDamage(atZero, 1, { critical: true }).state.deathSaves.failures).toBe(2)
  })

  it('damage to a stable character puts it back to dying', () => {
    const c = takeDamage(stabilize(atZero), 2)
    expect(vitals(c)).toBe('dying')
    expect(c.state.deathSaves).toEqual({ successes: 0, failures: 1 })
  })

  it('healing resets death saves', () => {
    const c = heal(rollDeathSave(atZero, 3), 5)
    expect(c.state.deathSaves).toEqual({ successes: 0, failures: 0 })
  })
})

describe('slots and resources', () => {
  it('clamps slot use to the table', () => {
    // Fighter 5 / Wizard 2: caster level 2, three 1st-level slots.
    expect(setSlotUsed(fighter, 1, 10).state.spellSlotsUsed[0]).toBe(3)
    expect(setSlotUsed(fighter, 2, 1).state.spellSlotsUsed[1]).toBe(0)
  })

  it('ignores unknown resources', () => {
    expect(setResourceUsed(fighter, 'ki', 1)).toBe(fighter)
  })
})

describe('feature uses', () => {
  const lock = makeCharacter({ classes: [{ classId: 'warlock', level: 1, subclassId: 'hexblade' }] })
  const curse = getResources(lock).find(r => r.id.startsWith('sub:hexblade:'))

  it('subclass features with uses are tracked and come back on their rest', () => {
    expect(curse).toMatchObject({ max: 1, recharge: 'short' })
    const spent = setResourceUsed(lock, curse!.id, 1)
    expect(spent.state.resources[curse!.id].used).toBe(1)
    expect(shortRest(spent).state.resources[curse!.id].used).toBe(0)
    expect(longRest(spent).state.resources[curse!.id].used).toBe(0)
  })

  it('a long-rest use stays spent through a short rest', () => {
    const spent = setResourceUsed(fighter, 'arcane-recovery', 1)
    expect(shortRest(spent).state.resources['arcane-recovery'].used).toBe(1)
    expect(longRest(spent).state.resources['arcane-recovery'].used).toBe(0)
  })
})

describe('short rest', () => {
  it('restores short-rest resources only', () => {
    let c = setResourceUsed(fighter, 'action-surge', 1)
    c = setResourceUsed(c, 'second-wind', 1)
    c = shortRest(setSlotUsed(c, 1, 2))
    expect(c.state.resources['action-surge'].used).toBe(0)
    expect(c.state.resources['second-wind'].used).toBe(0)
    expect(c.state.spellSlotsUsed[0]).toBe(2)
  })

  it('restores warlock pact slots', () => {
    const lock = makeCharacter({ classes: [{ classId: 'warlock', level: 5 }] })
    expect(shortRest(setPactUsed(lock, 2)).state.pactSlotsUsed).toBe(0)
  })

  it('spends hit dice for roll + CON', () => {
    const hurt = takeDamage(fighter, 20)
    const c = spendHitDie(hurt, 'd10', 6)
    expect(c.state.currentHp).toBe(hurt.state.currentHp + 6 + 2)
    expect(hitDiceRemaining(c).find(h => h.die === 'd10')?.remaining).toBe(4)
  })

  it('cannot spend dice that are gone, or while dying', () => {
    let c = takeDamage(fighter, 30)
    for (let i = 0; i < 6; i++) c = spendHitDie(c, 'd6', 1)
    expect(c.state.hitDiceSpent.d6).toBe(2)
    expect(spendHitDie(atZero, 'd10', 6)).toBe(atZero)
  })

  it('resets short-rest counters and keeps others', () => {
    let c = upsertCounter(fighter, { id: 'arrows', label: 'Arrows', max: 20, used: 7, recharge: 'none' })
    c = upsertCounter(c, { id: 'wand', label: 'Wand', max: 3, used: 2, recharge: 'short' })
    c = shortRest(c)
    expect(c.state.counters?.map(k => k.used)).toEqual([7, 0])
  })
})

describe('long rest', () => {
  it('restores HP, slots, resources and clears temp HP', () => {
    let c = takeDamage(grantTempHp(fighter, 3), 25)
    c = setSlotUsed(setResourceUsed(c, 'arcane-recovery', 1), 1, 3)
    c = grantTempHp(c, 4)
    c = longRest(c)
    expect(c.state.currentHp).toBe(MAX)
    expect(c.state.tempHp).toBe(0)
    expect(c.state.spellSlotsUsed[0]).toBe(0)
  })

  it('regains half the total hit dice, largest first', () => {
    let c = takeDamage(fighter, 40)
    for (let i = 0; i < 5; i++) c = spendHitDie(c, 'd10', 1)
    for (let i = 0; i < 2; i++) c = spendHitDie(c, 'd6', 1)
    c = longRest(c)
    // 7 total dice, regain 3: all from the d10s.
    expect(c.state.hitDiceSpent).toEqual({ d10: 2, d6: 2 })
  })

  it('needs at least 1 HP', () => {
    expect(canLongRest(atZero)).toBe(false)
    expect(longRest(atZero)).toBe(atZero)
  })
})

describe('old saves and dawn', () => {
  it('drops fields of removed features from old saves', () => {
    const old = { ...fighter.state, exhaustion: 2, inspiration: true, attuned: ['Ring'], clock: 600 }
    const { state } = makeCharacter({ state: old })
    for (const k of ['exhaustion', 'inspiration', 'attuned', 'clock']) expect(state).not.toHaveProperty(k)
  })

  const wand = { id: 'wand', label: 'Wand of Magic Missiles', max: 7, used: 6, recharge: 'dawn' as const, regain: '1d6+1' }
  const staff = { id: 'staff', label: 'Staff charges', max: 10, used: 4, recharge: 'dawn' as const }
  const charged = upsertCounter(upsertCounter(fighter, wand), staff)

  it('dawn regains rolled charges, capped at max, and refills trackers without dice', () => {
    const c = dawn(charged, { wand: 4 })
    expect(c.state.counters?.find(k => k.id === 'wand')?.used).toBe(2)
    expect(c.state.counters?.find(k => k.id === 'staff')?.used).toBe(0)
    expect(dawn(charged, { wand: 9 }).state.counters?.find(k => k.id === 'wand')?.used).toBe(0)
  })

  it('rests do not recharge dawn trackers', () => {
    const c = longRest(charged)
    expect(c.state.counters?.find(k => k.id === 'wand')?.used).toBe(6)
    expect(dawnCounters(c)).toHaveLength(2)
  })
})

describe('hit dice preview', () => {
  it('averages a die plus CON, never below 0 per roll', () => {
    expect(hitDieAverage('d8', 0)).toBe(4.5)
    expect(hitDieAverage('d10', 2)).toBe(7.5)
    expect(hitDieAverage('d6', -2)).toBe((0 + 0 + 1 + 2 + 3 + 4) / 6)
  })
  it('counts the dice needed to heal the missing HP', () => {
    expect(hitDicePreview(fighter)).toMatchObject({ missing: 0, dice: 0, enough: true })
    const hurt = takeDamage(fighter, 3)
    const p = hitDicePreview(hurt)
    expect(p).toMatchObject({ missing: 3, dice: 1, heal: 3, enough: true })
  })
  it('says when all dice are not enough', () => {
    let c = takeDamage(fighter, MAX - 1)
    const p = hitDicePreview(c)
    const left = hitDiceRemaining(c).reduce((n, h) => n + h.remaining, 0)
    expect(p.dice).toBe(left)
    expect(p.enough).toBe(p.heal >= p.missing)
    c = { ...c, state: { ...c.state, hitDiceSpent: Object.fromEntries(hitDiceRemaining(c).map(h => [h.die, h.total])) } }
    expect(hitDicePreview(c)).toMatchObject({ dice: 0, heal: 0, enough: false })
  })
})
