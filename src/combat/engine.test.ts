import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import {
  addCombatant, addEffect, breakConcentration, concentrationDc, concentrationOf, createEncounter, damageNpc,
  critDice, effectConditions, elapsedSeconds, endCombat, fightStatus, isBloodied, legendaryCost, nextTurn, rechargeAction, removeCombatant, resolveCheck,
  setInitiative, spendAction, startCombat, statusOf, syncPartyConditions, spendLegendary, targetGroups, waitingForInitiative,
} from './engine'
import type { Encounter } from './types'

const npc = (id: string, initiative: number, initBonus = 0, hp = 10) =>
  ({ id, name: id, kind: 'npc' as const, initiative, initBonus, hp: { current: hp, max: hp, temp: 0 }, conSave: 0 })

function party(): Encounter {
  let e = createEncounter('e1', 'u1', 'Goblin ambush', '2026-10-25T00:00:00Z')
  e = addCombatant(e, npc('goblin', 12, 2))
  e = addCombatant(e, npc('wizard', 18, 1))
  e = addCombatant(e, npc('orc', 12, 1))
  return e
}

const order = (e: Encounter) => e.combatants.map(c => c.id)

describe('initiative order', () => {
  it('sorts high to low and breaks ties on the modifier', () => {
    expect(order(party())).toEqual(['wizard', 'goblin', 'orc'])
  })

  it('needs every initiative before combat starts', () => {
    const e = setInitiative(party(), 'orc', null)
    expect(startCombat(e).round).toBe(0)
    expect(order(e)).toEqual(['wizard', 'goblin', 'orc'])
  })

  it('runs turns in order and counts rounds', () => {
    let e = startCombat(party())
    expect([e.round, e.activeId]).toEqual([1, 'wizard'])
    e = nextTurn(nextTurn(e))
    expect([e.round, e.activeId]).toEqual([1, 'orc'])
    e = nextTurn(e)
    expect([e.round, e.activeId]).toEqual([2, 'wizard'])
  })

  it('skips monsters at 0 HP', () => {
    let e = startCombat(party())
    e = damageNpc(e, 'goblin', 10, 'c1')
    e = nextTurn(e)
    expect(e.activeId).toBe('orc')
  })

  it('a late joiner slots into the order without changing whose turn it is', () => {
    let e = nextTurn(startCombat(party()))
    e = addCombatant(e, npc('wolf', 20))
    expect(e.activeId).toBe('goblin')
    expect(order(e)[0]).toBe('wolf')
  })

  it('removing the active combatant passes the turn on', () => {
    const e = removeCombatant(startCombat(party()), 'wizard')
    expect(e.activeId).toBe('goblin')
  })

  it('shows elapsed time in 6 second rounds', () => {
    expect(elapsedSeconds(1)).toBe(0)
    expect(elapsedSeconds(11)).toBe(60)
  })
})

const effect = (id: string, over: Partial<Parameters<typeof addEffect>[1]> = {}) => ({
  id, name: id, sourceId: 'wizard', targetIds: ['orc'], concentration: false,
  remaining: 1, tick: 'start' as const, ...over,
})

describe('timers', () => {
  it('a 1 minute spell lasts 10 rounds and ends at the start of the caster\'s turn', () => {
    let e = addEffect(startCombat(party()), effect('Bless', { remaining: 10 }))
    for (let i = 0; i < 29; i++) e = nextTurn(e) // through the end of round 10
    expect(e.effects).toHaveLength(1)
    e = nextTurn(e) // wizard's turn, round 11
    expect([e.round, e.activeId]).toEqual([11, 'wizard'])
    expect(e.effects).toHaveLength(0)
    expect(e.log).toContainEqual({ key: 'combat.log.ends', vars: { effect: 'Bless' } })
  })

  it('"until the end of your next turn" skips the end of the turn it was cast on', () => {
    let e = addEffect(startCombat(party()), effect('Shield of Faith', { tick: 'end' }))
    e = nextTurn(e) // end of wizard's turn 1
    expect(e.effects).toHaveLength(1)
    e = nextTurn(nextTurn(e)) // back to wizard, round 2
    expect(e.effects).toHaveLength(1)
    e = nextTurn(e) // end of wizard's turn 2
    expect(e.effects).toHaveLength(0)
  })

  it('effects with no source tick at the top of each round', () => {
    let e = addEffect(startCombat(party()), effect('Web', { sourceId: undefined, remaining: 1 }))
    e = nextTurn(nextTurn(e))
    expect(e.effects).toHaveLength(1)
    e = nextTurn(e)
    expect(e.effects).toHaveLength(0)
  })

  it('remembers that a fight ended, and forgets it when combat starts again', () => {
    let e = nextTurn(startCombat(party()))
    expect(fightStatus(e)).toBe('fighting')
    e = endCombat(e, '2026-11-01T00:00:00Z')
    expect(e).toMatchObject({ round: 0, endedAt: '2026-11-01T00:00:00Z', endedRound: e.endedRound })
    expect(e.endedRound).toBeGreaterThanOrEqual(1)
    expect(fightStatus(e)).toBe('ended')
    expect(endCombat(e)).toBe(e)
    const again = startCombat(e)
    expect(again.endedAt).toBeUndefined()
    expect(fightStatus(again)).toBe('fighting')
  })

  it('effects with no duration stay until combat ends', () => {
    let e = addEffect(startCombat(party()), effect('Curse', { remaining: null }))
    for (let i = 0; i < 9; i++) e = nextTurn(e)
    expect(e.effects).toHaveLength(1)
    expect(endCombat(e).effects).toHaveLength(0)
  })

  it('a condition effect shows on its targets', () => {
    const e = addEffect(startCombat(party()), effect('Hold Person', { condition: 'paralyzed' }))
    expect(effectConditions(e, 'orc')).toEqual(['paralyzed'])
    expect(statusOf(e, e.combatants.find(c => c.id === 'orc')!, {}).conditions).toEqual(['paralyzed'])
  })
})

describe('concentration', () => {
  const concentrating = () =>
    addEffect(startCombat(party()), effect('Hold Person', { concentration: true, condition: 'paralyzed', remaining: 10 }))

  it('DC is 10 or half the damage', () => {
    expect(concentrationDc(7)).toBe(10)
    expect(concentrationDc(23)).toBe(11)
  })

  it('a new concentration spell ends the old one', () => {
    const e = addEffect(concentrating(), effect('Bless', { concentration: true, targetIds: ['goblin'] }))
    expect(e.effects.map(x => x.name)).toEqual(['Bless'])
  })

  it('damage queues a save per hit and a failure ends the spell', () => {
    let e = damageNpc(concentrating(), 'wizard', 4, 'c1')
    e = damageNpc(e, 'wizard', 30, 'c2')
    expect(e.pendingChecks.map(p => p.dc)).toEqual([10, 15])
    e = resolveCheck(e, 'c1', 12)
    expect(concentrationOf(e, 'wizard')?.name).toBe('Hold Person')
    e = resolveCheck(e, 'c2', 14)
    expect(concentrationOf(e, 'wizard')).toBeUndefined()
    expect(effectConditions(e, 'orc')).toEqual([])
  })

  it('an automatic failure ends it whatever the total', () => {
    const e = resolveCheck(damageNpc(concentrating(), 'wizard', 4, 'c1'), 'c1', 25, true)
    expect(e.effects).toHaveLength(0)
  })

  it('no save is queued for someone not concentrating', () => {
    expect(damageNpc(concentrating(), 'goblin', 5, 'c1').pendingChecks).toEqual([])
  })

  it('ends at 0 HP or when incapacitated', () => {
    const dropped = breakConcentration(damageNpc(concentrating(), 'wizard', 10, 'c1'), {})
    expect(dropped.effects).toHaveLength(0)
    expect(dropped.pendingChecks).toEqual([])
    const stunned = addEffect(concentrating(), effect('Stun', { sourceId: 'goblin', targetIds: ['wizard'], condition: 'stunned' }))
    expect(concentrationOf(breakConcentration(stunned, {}), 'wizard')).toBeUndefined()
  })
})

describe('party members', () => {
  const hero = makeCharacter({ id: 'hero' })
  const withHero = () => addCombatant(party(), { id: 'p1', name: hero.name, kind: 'pc', characterId: 'hero', initiative: 15, initBonus: 1 })

  it('reads HP and conditions from the character', () => {
    const e = withHero()
    const s = statusOf(e, e.combatants.find(c => c.id === 'p1')!, { hero })
    expect(s.hp).toBe(hero.state.currentHp)
  })

  it('writes effect conditions to the character and lifts them when the effect ends', () => {
    const before = startCombat(withHero())
    const after = addEffect(before, effect('Hold Person', { targetIds: ['p1'], condition: 'paralyzed', remaining: 1 }))
    const [held] = syncPartyConditions(before, after, { hero })
    expect(held.state.conditions).toEqual(['paralyzed'])
    const ended = nextTurn(nextTurn(nextTurn(nextTurn(after))))
    const [freed] = syncPartyConditions(after, ended, { hero: held })
    expect(freed.state.conditions).toEqual([])
  })

  it('leaves characters alone when nothing changes', () => {
    const e = startCombat(withHero())
    expect(syncPartyConditions(e, nextTurn(e), { hero })).toEqual([])
  })
})

describe('stat block actions', () => {
  it('spends and recharges an action', () => {
    let e = spendAction(party(), 'goblin', 'Fire Breath')
    expect(e.combatants.find(c => c.id === 'goblin')?.spent).toEqual({ 'Fire Breath': 1 })
    e = rechargeAction(e, 'goblin', 'Fire Breath', 3, 5)
    expect(e.combatants.find(c => c.id === 'goblin')?.spent).toEqual({ 'Fire Breath': 1 })
    e = rechargeAction(e, 'goblin', 'Fire Breath', 5, 5)
    expect(e.combatants.find(c => c.id === 'goblin')?.spent).toEqual({})
    expect(rechargeAction(e, 'goblin', 'Fire Breath', 6, 5)).toBe(e)
  })

  it('counts X/Day uses up', () => {
    const e = spendAction(spendAction(party(), 'goblin', 'Enslave'), 'goblin', 'Enslave')
    expect(e.combatants.find(c => c.id === 'goblin')?.spent?.Enslave).toBe(2)
  })

  it('limits legendary actions to three a round and refills them on the creature\'s turn', () => {
    let e = startCombat(party()) // wizard's turn
    e = spendLegendary(e, 'goblin', 'Tail Attack', 1)
    e = spendLegendary(e, 'goblin', 'Wing Attack (Costs 2 Actions)', legendaryCost('Wing Attack (Costs 2 Actions)'))
    expect(e.combatants.find(c => c.id === 'goblin')?.legendaryUsed).toBe(3)
    const refused = spendLegendary(e, 'goblin', 'Detect', 1)
    expect(refused).toBe(e)
    e = nextTurn(e) // goblin's turn: legendary actions come back
    expect(e.combatants.find(c => c.id === 'goblin')?.legendaryUsed).toBe(0)
  })

  it('knows bloodied', () => {
    expect(isBloodied({ current: 5, max: 10 })).toBe(true)
    expect(isBloodied({ current: 6, max: 10 })).toBe(false)
    expect(isBloodied({ current: 0, max: 10 })).toBe(false)
    expect(isBloodied(undefined)).toBe(false)
  })
})

describe('critical hit dice', () => {
  it('keeps only the dice of a damage formula', () => {
    expect(critDice('2d6+5')).toBe('2d6')
    expect(critDice('2d10 + 6')).toBe('2d10')
    expect(critDice('1d8+1d6+3')).toBe('1d8+1d6')
    expect(critDice('5')).toBeNull()
  })
})

describe('running turns', () => {
  const hero = { id: 'thora', name: 'Thora', kind: 'pc' as const, characterId: 'c1', initiative: null, initBonus: 1 }
  it('lists the other side first as targets, then allies, never the attacker', () => {
    const e = addCombatant(party(), hero)
    const g = targetGroups(e, 'goblin')
    expect(g.enemies.map(c => c.id)).toEqual(['thora'])
    expect(g.allies.map(c => c.id)).toEqual(['wizard', 'orc'])
    expect(targetGroups(e, 'thora').enemies.map(c => c.id)).toEqual(['wizard', 'goblin', 'orc'])
  })
  it('names who still needs initiative and whether they are all players', () => {
    let e = addCombatant(party(), hero)
    expect(waitingForInitiative(e)).toEqual({ rows: [expect.objectContaining({ id: 'thora' })], players: true })
    e = addCombatant(e, { ...npc('rat', 0), initiative: null })
    expect(waitingForInitiative(e).players).toBe(false)
    expect(waitingForInitiative(party())).toEqual({ rows: [], players: false })
  })
})
