/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { en } from '../i18n/locales/en'
import { loadKind } from '../content'
import {
  activePlan, addMonster, addPlan, changeCount, crLabel, difficulty, findMonsters, normalizeDm, NPC_TABLES,
  partyBudget, partySize, pickDm, planCombatants, planEntry, planXp, randomName, randomNpc, removePlan, XP_BUDGET,
} from './logic'
import { emptyDmState, type EncounterPlan } from './types'

const plan = (monsters: EncounterPlan['monsters'] = []): EncounterPlan => ({ id: 'p1', name: 'Fight 1', monsters })
const goblin = { monsterId: 'goblin', source: 'srd-5.1', name: 'Goblin', xp: 50, cr: 0.25 }

describe('encounter budget (SRD 5.2)', () => {
  it('has a row for every level', () => {
    expect(XP_BUDGET).toHaveLength(20)
    XP_BUDGET.forEach(([l, m, h]) => expect(l < m && m < h).toBe(true))
  })
  it('adds up per character across level groups', () => {
    expect(partyBudget([{ count: 4, level: 1 }])).toEqual({ low: 200, moderate: 300, high: 400 })
    expect(partyBudget([{ count: 3, level: 5 }, { count: 1, level: 4 }])).toEqual({ low: 1750, moderate: 2625, high: 3800 })
    expect(partySize([{ count: 3, level: 5 }, { count: 1, level: 4 }])).toBe(4)
  })
  it('clamps silly input', () => {
    expect(partyBudget([{ count: -2, level: 30 }])).toEqual({ low: 0, moderate: 0, high: 0 })
    expect(partyBudget([{ count: 1, level: 0 }]).low).toBe(50)
  })
  it('rates difficulty against the budget', () => {
    const b = partyBudget([{ count: 4, level: 1 }])
    expect(difficulty(0, b)).toBe('none')
    expect(difficulty(150, b)).toBe('trivial')
    expect(difficulty(200, b)).toBe('low')
    expect(difficulty(300, b)).toBe('moderate')
    expect(difficulty(400, b)).toBe('high')
    expect(difficulty(401, b)).toBe('beyond')
  })
})

describe('plans', () => {
  it('stacks the same monster and drops it at zero', () => {
    let p = addMonster(plan(), goblin)
    p = addMonster(p, goblin, 2)
    expect(p.monsters).toEqual([{ ...goblin, count: 3 }])
    expect(planXp(p)).toBe(150)
    p = changeCount(p, goblin, -3)
    expect(p.monsters).toEqual([])
  })
  it('keeps the active plan valid when one is removed', () => {
    let s = addPlan(emptyDmState(), plan())
    s = addPlan(s, { ...plan(), id: 'p2' })
    expect(activePlan(s)?.id).toBe('p2')
    s = removePlan(s, 'p2')
    expect(s.activePlanId).toBe('p1')
  })
  it('reads old or broken saves', () => {
    expect(normalizeDm(null, emptyDmState())).toEqual(emptyDmState())
    expect(normalizeDm({ npcs: 'x', party: [] }, emptyDmState()).party).toEqual([{ count: 4, level: 1 }])
  })
})

describe('library monsters', async () => {
  const monsters = await loadKind('monsters', { sources: ['srd-5.1'] })
  it('hands a plan to the combat tracker, one row per creature', () => {
    const g = monsters.find(m => m.id === 'goblin')!
    let n = 0
    const rows = planCombatants(addMonster(plan(), planEntry(g), 2), monsters, () => `id${++n}`)
    expect(rows.map(r => r.name)).toEqual(['Goblin 1', 'Goblin 2'])
    expect(rows[0]).toMatchObject({ kind: 'npc', ac: 15, initBonus: 2, conSave: 0, hp: { current: 7, max: 7, temp: 0 } })
  })
  it('searches by name, CR and type, easiest first', () => {
    const found = findMonsters(monsters, { text: '', minCr: 1, maxCr: 2, type: 'undead' })
    expect(found.length).toBeGreaterThan(0)
    expect(found.every(m => m.challengeRating >= 1 && m.challengeRating <= 2 && m.type === 'undead')).toBe(true)
    expect(findMonsters(monsters, { text: 'GOBL', minCr: null, maxCr: null, type: '' }).map(m => m.id)).toContain('goblin')
  })
  it('shows fractional CRs the usual way', () => {
    expect([0.125, 0.25, 0.5, 3].map(crLabel)).toEqual(['1/8', '1/4', '1/2', '3'])
  })
})

describe('NPC generator', () => {
  it('is driven by the picker and stays inside the translated tables', () => {
    expect(randomName(() => 0)).toBe('Aldric Ashford')
    const idea = randomNpc(n => n - 1)
    expect(idea.role).toBe(NPC_TABLES.role - 1)
    for (const [kind, size] of Object.entries(NPC_TABLES)) {
      for (let i = 0; i < size; i++) expect(en).toHaveProperty(`dm.npc.${kind}.${i}`)
      expect(en).not.toHaveProperty(`dm.npc.${kind}.${size}`)
    }
  })
})

describe('DM sync', () => {
  const local = { ...emptyDmState(), npcs: [{ id: 'n', name: 'Local', role: '', notes: '' }] }
  const server = { ...emptyDmState(), npcs: [{ id: 'n', name: 'Server', role: '', notes: '' }] }
  it('keeps unsent edits from this device and sends them', () => {
    expect(pickDm(local, true, server)).toEqual({ state: local, push: true })
  })
  it('takes the server copy otherwise', () => {
    expect(pickDm(local, false, server)).toEqual({ state: server, push: false })
  })
  it('uploads this device copy when the server has none yet', () => {
    expect(pickDm(local, false, null)).toEqual({ state: local, push: true })
  })
})

describe('DM screen styles', () => {
  // ?raw imports of CSS come back empty under Vitest, so read the file itself.
  const css = readFileSync(new URL('./dm.css', import.meta.url), 'utf8')

  it('uses logical properties only, so RTL needs no overrides', () => {
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/)
  })

  it('reads the glass tokens instead of hard-coding blur', () => {
    expect(css).not.toMatch(/backdrop-filter:\s*blur/)
    expect(css).toMatch(/var\(--glass-regular\)/)
  })
})
