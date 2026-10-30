import { describe, expect, it } from 'vitest'
import { stepIssues, type StepId } from '../builder/validate'
import { derive } from '../rules'
import { STARTER_HEROES, createStarter } from './heroes'

const STEPS: StepId[] = ['race', 'class', 'abilities', 'skills', 'spells', 'equipment', 'details']

describe('starter heroes', () => {
  it('have unique ids and classes', () => {
    expect(new Set(STARTER_HEROES.map(h => h.id)).size).toBe(STARTER_HEROES.length)
    expect(new Set(STARTER_HEROES.map(h => h.draft.classes[0].classId)).size).toBe(STARTER_HEROES.length)
  })

  for (const hero of STARTER_HEROES) {
    it(`${hero.draft.name} passes every builder step`, () => {
      const draft = { ...hero.draft, ownerId: 'p1', playerName: 'Ana' }
      for (const step of STEPS) expect(stepIssues(step, draft), step).toEqual([])
    })

    it(`${hero.draft.name} is created at full HP with no warnings`, () => {
      const c = createStarter(hero, 'p1', 'Ana')
      const d = derive(c)
      expect(c.ownerId).toBe('p1')
      expect(c.playerName).toBe('Ana')
      expect(c.state.currentHp).toBe(d.maxHp)
      expect(d.warnings).toEqual([])
      expect(c.notes).toContain('How to play:')
    })
  }

  it('gives each copy its own id and does not share arrays with the template', () => {
    const hero = STARTER_HEROES[0]
    const a = createStarter(hero, 'p1', 'Ana')
    const b = createStarter(hero, 'p2', 'Ben')
    expect(a.id).not.toBe(b.id)
    a.chosenSkills.push('stealth')
    expect(hero.draft.chosenSkills).not.toContain('stealth')
  })
})

describe('picker and heroes list styles', () => {
  it('use logical properties only, so RTL needs no overrides', async () => {
    const { readFileSync } = await import('node:fs')
    for (const file of ['./starters.css', '../list/list.css']) {
      const css = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/)
    }
  })
})
