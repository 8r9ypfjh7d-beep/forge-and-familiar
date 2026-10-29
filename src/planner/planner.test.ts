import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Feature } from '../content/types'
import { derive } from '../rules'
import { makeCharacter } from '../sheet/fixtures'
import { fillWith, planAt, planSteps, routeFor, setClass, setEntry, stepLibraryFeatures } from './plan'

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
