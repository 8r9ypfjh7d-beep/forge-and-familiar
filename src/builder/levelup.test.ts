import { describe, expect, it } from 'vitest'
import { derive, getMaxHp, hpRollKey, levelForXp, totalLevel, xpAtLevel, xpReady } from '../rules'
import { makeCharacter } from '../sheet/fixtures'
import { gainedLevel, levelGain, levelUpDraft, newImprovementSlots, newIssues, nextClass, withHpRoll } from './levelup'

const fighter = (level: number, extra = {}) =>
  makeCharacter({ classes: [{ classId: 'fighter', level, ...(level >= 3 ? { subclassId: 'champion' } : {}) }], featureChoices: { 'fighter.fightingStyle': 'defense' }, ...extra })

describe('XP', () => {
  it('reads the level XP reaches and when it is enough for the next', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(299)).toBe(1)
    expect(levelForXp(300)).toBe(2)
    expect(levelForXp(400000)).toBe(20)
    expect(xpReady(fighter(3, { xp: 2700 }))).toBe(true)
    expect(xpReady(fighter(3, { xp: 2699 }))).toBe(false)
    expect(xpReady(fighter(20, { xp: 999999 }))).toBe(false)
  })
})

describe('level up', () => {
  it('moves XP up to the new level\'s threshold, never down', () => {
    const fresh = fighter(3, { xp: 0 })
    const { after } = levelGain(fresh, levelUpDraft(fresh, 'fighter'))
    expect(after.xp).toBe(xpAtLevel(totalLevel(after)))
    expect(after.xp).toBeGreaterThan(0)
    const rich = fighter(3, { xp: 999999 })
    expect(levelGain(rich, levelUpDraft(rich, 'fighter')).after.xp).toBe(999999)
  })

  it('adds one level to the planned class, else the first', () => {
    expect(nextClass(fighter(3))).toEqual({ classId: 'fighter', planned: false })
    const planned = fighter(3, { levelPlan: [{ level: 4, classId: 'wizard' }] })
    expect(nextClass(planned)).toEqual({ classId: 'wizard', planned: true })
    const d = levelUpDraft(planned, 'wizard')
    expect(d.classes).toEqual([{ classId: 'fighter', level: 3, subclassId: 'champion' }, { classId: 'wizard', level: 1 }])
    expect(gainedLevel(planned, d)).toEqual({ classId: 'wizard', level: 1 })
  })

  it('takes the planned subclass and ASI for the level', () => {
    const two = fighter(2, { levelPlan: [{ level: 3, classId: 'fighter', subclassId: 'champion' }] })
    expect(levelUpDraft(two, 'fighter').classes[0].subclassId).toBe('champion')
    const three = fighter(3, { levelPlan: [{ level: 4, classId: 'fighter', abilities: { str: 2 } }] })
    expect(levelUpDraft(three, 'fighter').improvements).toEqual([{ classId: 'fighter', level: 4, abilities: { str: 2 } }])
  })

  it('opens only the new ASI slot and asks for it', () => {
    const c = fighter(3)
    const d = levelUpDraft(c, 'fighter')
    expect(newImprovementSlots(c, d)).toEqual([{ classId: 'fighter', level: 4 }])
    expect(newIssues(c, d).map(i => i.step)).toEqual(['abilities'])
    expect(newIssues(c, { ...d, improvements: [{ classId: 'fighter', level: 4, abilities: { con: 2 } }] })).toEqual([])
  })

  it('asks for the subclass when it is due, but not for gaps the character already had', () => {
    const c = fighter(2)
    expect(newIssues(c, levelUpDraft(c, 'fighter')).map(i => i.step)).toEqual(['class'])
    const old = fighter(4, { featureChoices: {} })
    expect(newIssues(old, levelUpDraft(old, 'fighter'))).toEqual([])
  })

  it('uses a rolled hit die in place of the average and shows the HP gained', () => {
    const c = fighter(3)
    const d = levelUpDraft(c, 'fighter')
    const average = levelGain(c, d).hp
    const rolled = withHpRoll(c, d, 2)
    expect(rolled.hpRolls).toEqual({ [hpRollKey('fighter', 4)]: 2 })
    expect(levelGain(c, rolled).hp).toBe(average - 4)
    expect(withHpRoll(c, rolled, undefined).hpRolls).toEqual({})
    // The first level always takes the full die.
    expect(getMaxHp(fighter(1, { hpRolls: { 'fighter.1': 1 } }))).toBe(getMaxHp(fighter(1)))
  })

  it('lists the features the new level brings', () => {
    const c = fighter(4)
    const gain = levelGain(c, levelUpDraft(c, 'fighter'))
    expect(gain.level).toBe(5)
    expect(gain.profUp).toBe(true)
    expect(gain.features.map(f => f.name)).toContain('Extra Attack')
    expect(derive(gain.after).level).toBe(5)
  })
})
