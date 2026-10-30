import { describe, expect, it } from 'vitest'
import { loadKind } from '../content'
import { legendaryCount, legendaryResistance, perDayGroups, spellSlots, usageText } from '../monsters'
import {
  heal, longRest, newNpc, normalize, npcDefense, rechargeRoll, resetToBook, setCondition, setMaxHp, setTempHp, setUses, shortRest,
  spendLegendary, spendSlot, spendSpellUse, startTurn, takeDamage, useAction, useLegendaryResistance,
} from './engine'
import { makeBlock } from './fixtures'
import { NPC_SCHEMA_VERSION } from './types'

const npc = () => newNpc({ id: 'vexa', ownerId: 'acct-noa', name: 'Captain Vexa', block: makeBlock(), base: { source: 'srd-5.1', id: 'bandit-captain', name: 'Bandit Captain' } }, '2026-10-30T20:00:00.000Z')
const breath = makeBlock().actions[1]
const rally = makeBlock().actions[2]
const secondWind = makeBlock().actions[3]

describe('an NPC sheet', () => {
  it('starts at full HP with its own name over the creature’s', () => {
    const n = npc()
    expect(n.name).toBe('Captain Vexa')
    expect(n.block.name).toBe('Test Captain')
    expect(n.state.currentHp).toBe(65)
    expect(n.schemaVersion).toBe(NPC_SCHEMA_VERSION)
    expect(n.base?.id).toBe('bandit-captain')
  })

  it('normalizes an old or broken save without touching the block', () => {
    const raw = { ...npc(), state: { currentHp: 900, conditions: ['prone', 'prone'] } } as unknown as Parameters<typeof normalize>[0]
    const n = normalize(raw)
    expect(n.state).toEqual({ currentHp: 65, tempHp: 0, conditions: ['prone'], uses: {}, legendaryUsed: 0, legendaryResistanceUsed: 0, slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0], spellUses: {} })
  })
})

describe('damage', () => {
  it('applies vulnerability, resistance and immunity from the block’s free-text lines', () => {
    expect(npcDefense(npc(), 'cold')).toBe('vulnerable')
    expect(npcDefense(npc(), 'slashing')).toBe('resistant')
    expect(npcDefense(npc(), 'Poison')).toBe('immune')
    expect(npcDefense(npc(), 'fire')).toBeUndefined()
    expect(npcDefense(npc(), undefined)).toBeUndefined()
    expect(takeDamage(npc(), 10, 'cold').npc.state.currentHp).toBe(45)
    expect(takeDamage(npc(), 9, 'piercing').npc.state.currentHp).toBe(61)
    expect(takeDamage(npc(), 9, 'poison').npc.state.currentHp).toBe(65)
    expect(takeDamage(npc(), 9).npc.state.currentHp).toBe(56)
  })

  it('spends temporary hit points first and never goes below 0', () => {
    const n = setTempHp(npc(), 5)
    const hit = takeDamage(n, 8)
    expect(hit.npc.state).toMatchObject({ tempHp: 0, currentHp: 62 })
    expect(hit.lost).toBe(3)
    expect(takeDamage(n, 500).npc.state.currentHp).toBe(0)
    expect(setTempHp(setTempHp(npc(), 5), 3).state.tempHp).toBe(5)
  })

  it('heals up to the max, and a new max keeps the damage taken', () => {
    const hurt = takeDamage(npc(), 20).npc
    expect(heal(hurt, 100).state.currentHp).toBe(65)
    expect(setMaxHp(hurt, 80).state.currentHp).toBe(60)
    expect(setMaxHp(hurt, 10).state.currentHp).toBe(0)
  })

  it('petrified resists everything', () => {
    expect(npcDefense(setCondition(npc(), 'petrified', true), 'fire')).toBe('resistant')
  })
})

describe('conditions', () => {
  it('refuses conditions the block is immune to', () => {
    expect(setCondition(npc(), 'poisoned', true).state.conditions).toEqual([])
    const n = setCondition(npc(), 'prone', true)
    expect(n.state.conditions).toEqual(['prone'])
    expect(setCondition(n, 'prone', false).state.conditions).toEqual([])
  })
})

describe('limited actions', () => {
  it('counts per-day uses and pins them to the sheet’s pips', () => {
    let n = useAction(npc(), rally)
    n = useAction(n, rally)
    expect(n.state.uses.Rally).toBe(2)
    expect(useAction(useAction(n, rally), rally).state.uses.Rally).toBe(3)
    expect(setUses(n, rally, 9).state.uses.Rally).toBe(3)
    expect(useAction(n, makeBlock().actions[0]).state.uses).toEqual(n.state.uses)
  })

  it('recharges on the roll’s minimum, not before', () => {
    const spent = useAction(npc(), breath)
    expect(spent.state.uses['Fire Breath']).toBe(1)
    expect(rechargeRoll(spent, breath, 4).state.uses['Fire Breath']).toBe(1)
    expect(rechargeRoll(spent, breath, 5).state.uses['Fire Breath']).toBe(0)
  })

  it('gives a short rest only per-rest and recharge actions back, and a long rest everything', () => {
    let n = useAction(useAction(useAction(npc(), rally), breath), secondWind)
    n = takeDamage(spendSlot(spendSpellUse(useLegendaryResistance(n), '1/day each'), 1), 30).npc
    const short = shortRest(n)
    expect(short.state.uses).toEqual({ Rally: 1 })
    expect(short.state.currentHp).toBe(35)
    const long = longRest(n)
    expect(long.state).toMatchObject({ uses: {}, currentHp: 65, legendaryResistanceUsed: 0, slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0], spellUses: {} })
  })
})

describe('legendary', () => {
  it('reads counts from the text and spends them per round', () => {
    expect(legendaryCount(makeBlock())).toBe(2)
    expect(legendaryResistance(makeBlock())).toBe(2)
    let n = spendLegendary(spendLegendary(spendLegendary(npc())))
    expect(n.state.legendaryUsed).toBe(2)
    n = startTurn(n)
    expect(n.state.legendaryUsed).toBe(0)
    n = useLegendaryResistance(useLegendaryResistance(useLegendaryResistance(npc())))
    expect(n.state.legendaryResistanceUsed).toBe(2)
  })

  it('prefers the shared legendary field when a block has it', () => {
    const b = makeBlock({ legendary: { actions: 3, resistance: 5 } })
    expect(legendaryCount(b)).toBe(3)
    expect(legendaryResistance(b)).toBe(5)
    expect(spendLegendary(npc(), 1).state.legendaryUsed).toBe(1)
  })
})

describe('spells', () => {
  it('reads slots and per-day groups from the spellcasting labels', () => {
    expect(spellSlots(makeBlock())).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(perDayGroups(makeBlock())).toEqual({ '1/day each': 1 })
    let n = spendSlot(spendSlot(npc(), 1), 2)
    expect(n.state.slotsUsed.slice(0, 2)).toEqual([1, 1])
    n = spendSlot(n, 1, true)
    expect(n.state.slotsUsed[0]).toBe(0)
    expect(spendSlot(npc(), 5).state.slotsUsed[4]).toBe(0)
    expect(spendSpellUse(spendSpellUse(npc(), '1/day each'), '1/day each').state.spellUses).toEqual({ '1/day each': 1 })
    expect(spendSpellUse(npc(), 'Cantrips (at will)').state.spellUses).toEqual({})
  })
})

describe('reset to book', () => {
  it('puts the book’s block back but keeps the NPC’s max HP choice', () => {
    const tweaked = { ...npc(), block: { ...makeBlock(), armorClass: [{ value: 20 }], hitPoints: 80 } }
    const back = resetToBook(tweaked, makeBlock())
    expect(back.block.armorClass[0].value).toBe(15)
    expect(back.block.hitPoints).toBe(80)
  })
})

describe('SRD stat blocks', () => {
  it('give an adult red dragon 3 legendary actions, 3 legendary resistances and a recharge breath', async () => {
    const monsters = await loadKind('monsters', { sources: ['srd-5.1'] })
    const dragon = monsters.find(m => m.id === 'adult-red-dragon')!
    expect(legendaryCount(dragon)).toBe(3)
    expect(legendaryResistance(dragon)).toBe(3)
    const breath = dragon.actions.find(a => /breath/i.test(a.name))!
    expect(usageText(breath)).toBe(' (Recharge 5–6)')
    const n = newNpc({ id: 'x', ownerId: 'o', name: 'Ember', block: dragon })
    expect(n.state.currentHp).toBe(dragon.hitPoints)
    expect(npcDefense(n, 'fire')).toBe('immune')
  })

  it('give every SRD monster a legendary count only when it has legendary actions', async () => {
    const monsters = await loadKind('monsters', { sources: ['srd-5.1'] })
    for (const m of monsters) expect(legendaryCount(m) > 0).toBe(m.legendaryActions.length > 0)
  })
})
