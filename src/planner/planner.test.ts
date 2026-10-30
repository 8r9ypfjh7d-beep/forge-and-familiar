import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Feature } from '../content/types'
import { draftFrom } from '../builder/edit'
import type { Character } from '../model/character'
import { CUSTOM_SUBCLASS, blankSubclass, derive, type CharacterDraft } from '../rules'
import { makeCharacter } from '../sheet/fixtures'
import { fillWith, followPlan, planAt, plannedPicks, planSteps, routeFor, setClass, setEntry, stepLibraryFeatures } from './plan'

const fighter = (level: number, extra = {}) =>
  makeCharacter({ classes: [{ classId: 'fighter', level, ...(level >= 3 ? { subclassId: 'champion' } : {}) }], ...extra })

describe('route to 20', () => {
  it('fills the levels after the current one with the first class', () => {
    const route = routeFor(fighter(3))
    expect(route.map(e => e.level)).toEqual(Array.from({ length: 17 }, (_, i) => i + 4))
    expect(route.every(e => e.classId === 'fighter')).toBe(true)
  })

  it('lets levels without an entry follow the class of the level before', () => {
    const c = fighter(3, { levelPlan: [{ level: 6, classId: 'wizard' }] })
    expect(routeFor(c).slice(0, 5).map(e => e.classId)).toEqual(['fighter', 'fighter', 'wizard', 'wizard', 'wizard'])
  })

  it('ignores entries at or below the current level and plans nothing at 20', () => {
    expect(routeFor(fighter(5, { levelPlan: [{ level: 4, classId: 'wizard' }] }))[0]).toEqual({ level: 6, classId: 'fighter' })
    expect(planSteps(fighter(20))).toEqual([])
  })
})

describe('plan steps', () => {
  it('shows HP, proficiency and features each level brings', () => {
    const steps = planSteps(fighter(3))
    const five = steps.find(s => s.level === 5)!
    expect(five.profUp).toBe(true)
    expect(five.features.map(f => f.name)).toContain('Extra Attack')
    expect(five.hpGain).toBe(derive(planAt(fighter(3), 5)).maxHp - derive(planAt(fighter(3), 4)).maxHp)
    expect(steps[steps.length - 1].stats.level).toBe(20)
  })

  it('asks for the ASI at an ASI level and applies it once picked', () => {
    const c = fighter(3)
    expect(planSteps(c)[0]).toMatchObject({ level: 4, asiDue: true, needs: ['asi'] })
    const planned = { ...c, levelPlan: setEntry(c, { level: 4, classId: 'fighter', abilities: { str: 2 } }) }
    expect(planSteps(planned)[0].needs).toEqual([])
    expect(derive(planAt(planned, 4)).abilities.str).toBe(derive(c).abilities.str + 2)
  })

  it('warns when an ASI would take a score over 20', () => {
    const c = fighter(3, { baseAbilities: { str: 20, dex: 12, con: 14, int: 10, wis: 10, cha: 8 } })
    const planned = { ...c, levelPlan: [{ level: 4, classId: 'fighter', abilities: { str: 2 } }] }
    expect(planSteps(planned)[0].needs).toContain('abilityCap')
  })

  it('asks for a subclass at the subclass level and uses it', () => {
    const c = makeCharacter({ classes: [{ classId: 'wizard', level: 1 }] })
    expect(planSteps(c)[0]).toMatchObject({ subclassDue: true, needs: ['subclass'] })
    const planned = { ...c, levelPlan: [{ level: 2, classId: 'wizard', subclassId: 'evocation' }] }
    expect(planAt(planned, 2).classes[0].subclassId).toBe('evocation')
    expect(planSteps(planned)[0].subclassId).toBe('evocation')
  })

  it('shows new spell slot levels', () => {
    const c = makeCharacter({ classes: [{ classId: 'wizard', level: 2, subclassId: 'evocation' }] })
    expect(planSteps(c)[0].newSlotLevel).toBe(2)
  })

  it('flags a new class whose prerequisites are not met', () => {
    // The fixture has CHA 8: no Sorcerer.
    const c = fighter(3, { levelPlan: [{ level: 4, classId: 'sorcerer' }] })
    const [step] = planSteps(c)
    expect(step.newClass).toBe(true)
    expect(step.issues.join(' ')).toMatch(/Sorcerer needs CHA 13/)
  })
})

describe('editing the plan', () => {
  it('changing one level keeps the levels after it on their class', () => {
    const c = fighter(3)
    const plan = setClass(c, 4, 'wizard')
    const route = routeFor({ ...c, levelPlan: plan })
    expect(route[0].classId).toBe('wizard')
    expect(route.slice(1).every(e => e.classId === 'fighter')).toBe(true)
  })

  it('fills to 20 with one class', () => {
    expect(fillWith(fighter(18), 'fighter')).toEqual([{ level: 19, classId: 'fighter' }, { level: 20, classId: 'fighter' }])
  })
})

describe('library features', () => {
  const f = (over: Partial<Feature>): Feature => ({
    id: 'x', name: 'X', source: 'srd-5.1', edition: '2014', classId: 'fighter', level: 9, description: '', choices: [], subfeatures: [], ...over,
  } as Feature)

  it('lists the class and subclass features of the step, without options or the ASI', () => {
    const all = [
      f({ id: 'indomitable', name: 'Indomitable (1 use)' }),
      f({ id: 'asi', name: 'Ability Score Improvement', level: 8 }),
      f({ id: 'style', name: 'Fighting Style: Archery', parentId: 'fighting-style', level: 9 }),
      f({ id: 'crit', name: 'Superior Critical', subclassId: 'champion' }),
      f({ id: 'other', name: 'Other', subclassId: 'battle-master' }),
      f({ id: 'placeholder', name: 'Martial Archetype feature' }),
    ]
    const step = { entry: { level: 9, classId: 'fighter' }, classLevel: 9, subclassId: 'champion' }
    expect(stepLibraryFeatures(all, step).map(x => x.id)).toEqual(['indomitable', 'crit'])
    expect(stepLibraryFeatures(all, { ...step, subclassId: undefined }).map(x => x.id)).toEqual(['indomitable', 'placeholder'])
  })
})

describe('planner CSS', () => {
  it('uses logical properties only', () => {
    const css = readFileSync(new URL('./planner.css', import.meta.url), 'utf8')
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):|text-align:\s*(left|right)/)
  })
})

describe('subclass picks', () => {
  it('counts a subclass kept from before as picked at the subclass level', () => {
    const c = makeCharacter({ classes: [{ classId: 'fighter', level: 2, subclassId: 'champion' }] })
    const three = planSteps(c).find(s => s.level === 3)!
    expect(three.subclassDue).toBe(true)
    expect(three.subclassId).toBe('champion')
    expect(three.needs).not.toContain('subclass')
  })

  it('takes a custom subclass from the plan', () => {
    const c = fighter(2, { levelPlan: [{ level: 3, classId: 'fighter', subclassId: CUSTOM_SUBCLASS }] })
    const three = planSteps(c).find(s => s.level === 3)!
    expect(three.subclassId).toBe(CUSTOM_SUBCLASS)
    expect(three.needs).not.toContain('subclass')
  })
})

describe('levelling up from the plan', () => {
  const planned = fighter(2, {
    levelPlan: [
      { level: 3, classId: 'fighter', subclassId: 'champion' },
      { level: 4, classId: 'fighter', featId: 'grappler' },
    ],
  })
  const raise = (c: Character, level: number, patch: Partial<CharacterDraft> = {}) => {
    const before = draftFrom(c)
    return followPlan(c, before, { ...before, ...patch, classes: [{ ...before.classes[0], level }] })
  }

  it('fills the planned subclass and ASI for the levels gained', () => {
    const d = raise(planned, 4)
    expect(d.classes[0].subclassId).toBe('champion')
    expect(d.improvements).toEqual([{ classId: 'fighter', level: 4, featId: 'grappler' }])
    expect(plannedPicks(planned).subclasses.get('fighter')).toBe('champion')
  })

  it('leaves levels not gained and the player’s own picks alone', () => {
    expect(raise(planned, 2).classes[0].subclassId).toBeUndefined()
    const own = raise(planned, 4, { improvements: [{ classId: 'fighter', level: 4, abilities: { str: 2 } }] })
    expect(own.improvements).toEqual([{ classId: 'fighter', level: 4, abilities: { str: 2 } }])
    const before = draftFrom(planned)
    const picked = followPlan(planned, before, { ...before, classes: [{ classId: 'fighter', level: 3, subclassId: 'battle-master' }] })
    expect(picked.classes[0].subclassId).toBe('battle-master')
  })

  it('opens a blank custom subclass when the plan picked Custom', () => {
    const c = fighter(2, { levelPlan: [{ level: 3, classId: 'fighter', subclassId: CUSTOM_SUBCLASS }] })
    const d = raise(c, 3)
    expect(d.classes[0].subclassId).toBe(CUSTOM_SUBCLASS)
    expect(d.customSubclasses).toEqual([blankSubclass('fighter')])
  })

  it('does nothing without a plan', () => {
    const before = draftFrom(fighter(2))
    const next = { ...before, classes: [{ classId: 'fighter', level: 3 }] }
    expect(followPlan(fighter(2), before, next)).toBe(next)
  })
})
