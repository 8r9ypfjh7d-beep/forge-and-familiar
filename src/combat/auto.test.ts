import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import data from '../content/data/srd-5.1/monsters.json'
import type { Monster } from '../content'
import { attackAgainst, autoFails, fightOutcome, isDeadPc, monsterSave, multiattackPlan, pickTarget, rowHp, targetConditions } from './auto'
import { addCombatant, addEffect, createEncounter, nextTurn, resolveCheck, skipsTurn, startCombat } from './engine'
import type { Party } from './engine'
import type { Encounter } from './types'

const npc = (id: string, initiative: number, hp = 10) =>
  ({ id, name: id, kind: 'npc' as const, initiative, initBonus: 0, hp: { current: hp, max: 10, temp: 0 }, conSave: 0 })

function fight(party: Party): Encounter {
  let e = createEncounter('e', 'u', 'Fight')
  for (const [i, id] of Object.keys(party).entries()) e = addCombatant(e, { id: `pc-${id}`, name: id, kind: 'pc', characterId: id, initiative: 15 - i, initBonus: 0 })
  e = addCombatant(e, npc('g1', 20))
  e = addCombatant(e, npc('g2', 5))
  return e
}

const hero = (id: string, hp: number, failures = 0) => {
  const c = makeCharacter()
  return { ...c, id, state: { ...c.state, currentHp: hp, deathSaves: { successes: 0, failures } } }
}

describe('targets', () => {
  it('opens on the first conscious enemy and keeps a pick that still stands', () => {
    const party = { a: hero('a', 0), b: hero('b', 8) }
    const e = fight(party)
    expect(pickTarget(e, 'g1', party)).toBe('pc-b')
    expect(pickTarget(e, 'g1', party, 'pc-a')).toBe('pc-a')
    expect(pickTarget(e, 'pc-b', party)).toBe('g1')
  })

  it('skips a dead character and a fallen monster', () => {
    const party = { a: hero('a', 0, 3), b: hero('b', 8) }
    let e = fight(party)
    e = { ...e, combatants: e.combatants.map(c => (c.id === 'g1' ? { ...c, hp: { current: 0, max: 10, temp: 0 } } : c)) }
    expect(pickTarget(e, 'g2', party, 'pc-a')).toBe('pc-b')
    expect(pickTarget(e, 'pc-b', party, 'g1')).toBe('g2')
    expect(isDeadPc(e.combatants.find(c => c.id === 'pc-a')!, party)).toBe(true)
  })
})

describe('end of the fight', () => {
  it('is won when every monster is down, lost when every party member is', () => {
    const party = { a: hero('a', 5) }
    let e = fight(party)
    expect(fightOutcome(e, rowHp(e, party))).toBeNull()
    const down = (x: Encounter, id: string) => ({ ...x, combatants: x.combatants.map(c => (c.id === id ? { ...c, hp: { current: 0, max: 10, temp: 0 } } : c)) })
    e = down(down(e, 'g1'), 'g2')
    expect(fightOutcome(e, rowHp(e, party))).toBe('won')
    const lost = { a: hero('a', 0) }
    const f = fight(lost)
    expect(fightOutcome(f, rowHp(f, lost))).toBe('lost')
  })
})

describe('attacks against conditions', () => {
  it('gives advantage and a melee critical against an unconscious target', () => {
    expect(attackAgainst(['unconscious'], true)).toEqual({ mode: ['advantage'], autoCrit: true })
    expect(attackAgainst(['unconscious'], false)).toEqual({ mode: ['advantage'], autoCrit: false })
    expect(attackAgainst(['prone'], false).mode).toEqual(['disadvantage'])
    expect(attackAgainst(['invisible'], true).mode).toEqual(['disadvantage'])
  })

  it('treats a party member at 0 HP as unconscious', () => {
    const party = { a: hero('a', 0) }
    const e = fight(party)
    expect(targetConditions(e, e.combatants.find(c => c.id === 'pc-a')!, party)).toContain('unconscious')
    expect(autoFails(['unconscious'], 'dex')).toBe(true)
    expect(autoFails(['unconscious'], 'wis')).toBe(false)
  })
})

describe('stat blocks', () => {
  it('reads a Multiattack into the attacks it makes', () => {
    const troll = (data.entries as unknown as Monster[]).find(m => m.id === 'troll')!
    expect(multiattackPlan(troll)).toEqual(['Bite', 'Claw', 'Claw'])
    const a = (name: string) => ({ name, description: 'Melee Weapon Attack', damage: [], attackBonus: 4 })
    expect(multiattackPlan({ actions: [{ name: 'Multiattack', description: 'The bear makes two Rend attacks.', damage: [] }, a('Rend')] })).toEqual(['Rend', 'Rend'])
    expect(multiattackPlan({ actions: [{ name: 'Multiattack', description: 'The thug makes two melee attacks.', damage: [] }, a('Mace'), { ...a('Crossbow'), description: 'Ranged Weapon Attack' }] })).toEqual(['Mace', 'Mace'])
    expect(multiattackPlan({ actions: [{ name: 'Multiattack', description: 'The wererat makes two attacks, only one of which can be a bite.', damage: [] }, a('Bite'), a('Shortsword')] })).toBeNull()
  })

  it('uses a listed save, else the ability modifier', () => {
    expect(monsterSave({ abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 8, cha: 10 }, savingThrows: { wis: 3 } }, 'wis')).toBe(3)
    expect(monsterSave({ abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 8, cha: 10 }, savingThrows: {} }, 'dex')).toBe(2)
  })
})

describe('turns', () => {
  it('skips a party member with three failed death saves', () => {
    const party = { a: hero('a', 0, 3), b: hero('b', 8) }
    let e = startCombat(fight(party), party)
    expect(e.activeId).toBe('g1')
    e = nextTurn(e, party)
    expect(e.activeId).toBe('pc-b')
    expect(skipsTurn(e.combatants.find(c => c.id === 'pc-a')!, party)).toBe(true)
  })

  it('queues a repeat save at the end of a target\'s turn; a success frees it', () => {
    let e = startCombat(fight({}))
    e = addEffect(e, { id: 'hold', name: 'Hold Person', sourceId: 'g2', targetIds: ['g1'], condition: 'paralyzed', concentration: false, remaining: 10, tick: 'start', save: { ability: 'wis', dc: 13 } })
    expect(e.activeId).toBe('g1')
    e = nextTurn(e)
    expect(e.pendingChecks).toMatchObject([{ combatantId: 'g1', dc: 13, ability: 'wis', effectId: 'hold' }])
    const failed = resolveCheck(e, e.pendingChecks[0].id, 5)
    expect(failed.effects).toHaveLength(1)
    const freed = resolveCheck(e, e.pendingChecks[0].id, 15)
    expect(freed.effects).toHaveLength(0)
    expect(freed.pendingChecks).toHaveLength(0)
  })
})
