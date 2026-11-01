import { describe, expect, it } from 'vitest'
import { addCombatant, addEffect, createEncounter, setInitiative, startCombat } from './engine'
import { DM_ONLY_FIELDS, healthLook, playerCombatant, playerView } from './playerView'
import type { Combatant, Encounter } from './types'

const npc = (id: string, initiative: number, extra: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, kind: 'npc', initiative, initBonus: 3, hp: { current: 20, max: 20, temp: 0 }, ac: 15, conSave: 2, conditions: [], ...extra })
const pc = (id: string, initiative: number): Combatant =>
  ({ id, name: id, kind: 'pc', characterId: `char-${id}`, initiative, initBonus: 1, conditions: [] })

function fight(): Encounter {
  let e = createEncounter('e1', 'dm', 'Ambush', '2026-10-30T00:00:00Z')
  e = addCombatant(e, pc('vex', 15))
  e = addCombatant(e, npc('strahd', 20, { alias: 'Pale noble', hp: { current: 8, max: 20, temp: 0 } }))
  e = addCombatant(e, npc('goblin', 10, { revealHp: true, hp: { current: 7, max: 7, temp: 2 } }))
  e = addCombatant(e, npc('stalker', 18, { hidden: true }))
  return e
}

describe('playerView', () => {
  it('drops hidden rows and keeps initiative order', () => {
    const v = playerView(fight())
    expect(v.combatants.map(c => c.id)).toEqual(['strahd', 'vex', 'goblin'])
  })

  it('shows an alias instead of the real name and a health look instead of numbers', () => {
    const v = playerView(fight())
    const strahd = v.combatants.find(c => c.id === 'strahd')!
    expect(strahd.name).toBe('Pale noble')
    expect(strahd.look).toBe('bloodied')
    expect(strahd.hp).toBeUndefined()
  })

  it('reveals HP only when the DM says so', () => {
    const v = playerView(fight())
    const goblin = v.combatants.find(c => c.id === 'goblin')!
    expect(goblin.name).toBe('goblin')
    expect(goblin.hp).toEqual({ current: 7, max: 7, temp: 2 })
    expect(goblin.look).toBe('healthy')
  })

  it('never leaks AC, saves, bonuses or the DM-only switches', () => {
    for (const c of fight().combatants) {
      const row = playerCombatant(c, null)
      if (!row) continue
      for (const key of DM_ONLY_FIELDS) expect(row).not.toHaveProperty(key)
    }
  })

  it('never sends the DM notes or the plan link', () => {
    const view = playerView({ ...fight(), notes: 'The cultists flee at half HP', planId: 'plan-1' })
    expect(view).not.toHaveProperty('notes')
    expect(view).not.toHaveProperty('planId')
    expect(JSON.stringify(view)).not.toContain('cultists')
  })

  it('keeps party rows whole enough to link to the sheet', () => {
    const vex = playerView(fight()).combatants.find(c => c.id === 'vex')!
    expect(vex).toMatchObject({ kind: 'pc', characterId: 'char-vex', initiative: 15 })
    expect(vex.look).toBeUndefined()
  })

  it('hides the active turn and effects of a hidden row', () => {
    let e = startCombat(fight())
    expect(e.activeId).toBe('strahd')
    e = addEffect(e, { id: 'fx1', name: 'Hold Person', sourceId: 'stalker', targetIds: ['vex'], condition: 'paralyzed', concentration: true, remaining: 10, tick: 'start' })
    e = addEffect(e, { id: 'fx2', name: 'Hex', sourceId: 'stalker', targetIds: ['stalker'], concentration: false, remaining: null, tick: 'start' })
    e = { ...e, activeId: 'stalker' }
    const v = playerView(e)
    expect(v.activeId).toBeNull()
    expect(v.combatants.every(c => !c.active)).toBe(true)
    expect(v.effects.map(x => x.id)).toEqual(['fx1'])
    expect(v.effects[0].sourceId).toBeUndefined()
    expect(v.effects[0].targetIds).toEqual(['vex'])
  })

  it('marks the active row and leaves out the log and pending checks', () => {
    const e = startCombat(setInitiative(fight(), 'stalker', 1))
    const v = playerView(e) as unknown as Record<string, unknown>
    expect((v.combatants as { id: string; active: boolean }[]).find(c => c.active)?.id).toBe('strahd')
    expect(v).not.toHaveProperty('log')
    expect(v).not.toHaveProperty('pendingChecks')
    expect(v).not.toHaveProperty('ownerId')
  })

  it('reads health looks from HP', () => {
    expect(healthLook(undefined)).toBe('healthy')
    expect(healthLook({ current: 11, max: 20 })).toBe('healthy')
    expect(healthLook({ current: 10, max: 20 })).toBe('bloodied')
    expect(healthLook({ current: 0, max: 20 })).toBe('down')
  })
})
