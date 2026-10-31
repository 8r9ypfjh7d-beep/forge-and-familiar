import { describe, expect, it } from 'vitest'
import { newNpc } from '../npc/engine'
import { makeBlock } from '../npc/fixtures'
import { planCombatants, npcPlanEntry } from '../dm/logic'
import { addCombatant, createEncounter, damageNpc, nextTurn, rechargeAction, spendAction, spendLegendary, startCombat, updateCombatant } from './engine'
import { mirrorNpcs, npcChangesFromRows, npcCombatant, type NpcSheets } from './npcRows'
import { applyDamage, applyHeal, applyNpcConditions } from './ui/apply'
import type { Encounter } from './types'

const captain = () => newNpc({ id: 'vexa', ownerId: 'dm', name: 'Captain Vexa', block: makeBlock() }, '2026-10-31T00:00:00Z')

function fight(): { enc: Encounter; npcs: NpcSheets } {
  const npc = captain()
  let enc = createEncounter('e1', 'dm', 'Docks', '2026-10-31T00:00:00Z')
  enc = addCombatant(enc, { ...npcCombatant(npc, 'row-vexa'), initiative: 15 })
  enc = addCombatant(enc, { id: 'gob', name: 'Goblin', kind: 'npc', initiative: 10, initBonus: 2, hp: { current: 7, max: 7, temp: 0 } })
  return { enc, npcs: { vexa: npc } }
}

const row = (e: Encounter) => e.combatants.find(c => c.id === 'row-vexa')!
const outcome = (o: ReturnType<typeof applyDamage>) => ('encounter' in o ? o : { encounter: o, npcs: [] })

describe('NPC sheet rows', () => {
  it('a new row copies the sheet: name, block AC, DEX initiative, CON save, HP', () => {
    const r = npcCombatant(captain(), 'r1')
    expect(r).toMatchObject({ name: 'Captain Vexa', kind: 'npc', npcId: 'vexa', ac: 15, initBonus: 3, conSave: 2, hp: { current: 65, max: 65, temp: 0 } })
  })

  it('damage goes through the sheet: resistance halves, vulnerability doubles, immunity takes none', () => {
    const { enc, npcs } = fight()
    const cold = outcome(applyDamage(enc, {}, new Set(), 'row-vexa', [{ amount: 10, type: 'cold' }], 'c1', npcs))
    expect(cold.npcs?.[0].state.currentHp).toBe(45)
    const mixed = outcome(applyDamage(enc, {}, new Set(), 'row-vexa', [{ amount: 9, type: 'slashing' }, { amount: 6, type: 'poison' }], 'c1', npcs))
    expect(mixed.npcs?.[0].state.currentHp).toBe(61)
    expect(mixed.encounter.log.map(l => (typeof l === 'string' ? l : l.key))).toEqual(['combat.log.takes', 'combat.log.immune', 'combat.log.resists'])
  })

  it('healing and conditions go through the sheet, and immunities are refused', () => {
    const { enc, npcs } = fight()
    const hurt = outcome(applyDamage(enc, {}, new Set(), 'row-vexa', 20, 'c1', npcs)).npcs![0]
    expect(outcome(applyHeal(enc, {}, new Set(), 'row-vexa', 5, { vexa: hurt })).npcs?.[0].state.currentHp).toBe(50)
    const c = outcome(applyNpcConditions(enc, npcs.vexa!, ['prone', 'poisoned']))
    expect(c.npcs?.[0].state.conditions).toEqual(['prone'])
  })

  it('rows without a loaded sheet still work as plain monster rows', () => {
    const { enc } = fight()
    const out = applyDamage(enc, {}, new Set(), 'row-vexa', 10, 'c1', {})
    expect('encounter' in out ? out.encounter : out).toEqual(damageNpc(enc, 'row-vexa', 10, 'c1'))
  })

  it('mirrors the sheet onto its row and leaves other rows alone', () => {
    const { enc, npcs } = fight()
    expect(mirrorNpcs(enc, npcs)).toBe(enc)
    const hurt = { ...npcs.vexa!, state: { ...npcs.vexa!.state, currentHp: 30, conditions: ['prone' as const], uses: { 'Fire Breath': 1, Rally: 0 } } }
    const m = mirrorNpcs(enc, { vexa: hurt })
    expect(row(m)).toMatchObject({ hp: { current: 30, max: 65, temp: 0 }, conditions: ['prone'], spent: { 'Fire Breath': 1 } })
    expect(m.combatants.find(c => c.id === 'gob')).toBe(enc.combatants.find(c => c.id === 'gob'))
  })

  it('writes row changes made by the encounter engine back to the sheet', () => {
    const { enc, npcs } = fight()
    const spent = spendLegendary(spendAction(enc, 'row-vexa', 'Fire Breath'), 'row-vexa', 'Attack', 1, 2)
    const [s] = npcChangesFromRows(enc, spent, npcs)
    expect(s.state.uses).toEqual({ 'Fire Breath': 1 })
    expect(s.state.legendaryUsed).toBe(1)
    const recharged = rechargeAction(spent, 'row-vexa', 'Fire Breath', 6, 5)
    expect(npcChangesFromRows(spent, recharged, { vexa: s })[0].state.uses).toEqual({})
    const prone = updateCombatant(enc, 'row-vexa', { conditions: ['prone'] })
    expect(npcChangesFromRows(enc, prone, npcs)[0].state.conditions).toEqual(['prone'])
    expect(npcChangesFromRows(enc, prone, npcs, new Set(['vexa']))).toEqual([])
  })

  it('legendary actions come back on the sheet at the start of its turn', () => {
    const { enc, npcs } = fight()
    let e = startCombat(enc)
    e = spendLegendary(e, 'row-vexa', 'Attack', 2, 2)
    const used = npcChangesFromRows(startCombat(enc), e, npcs)[0]
    const turned = nextTurn(nextTurn(mirrorNpcs(e, { vexa: used })))
    expect(npcChangesFromRows(e, turned, { vexa: used })[0].state.legendaryUsed).toBe(0)
  })
})

describe('NPC sheets in encounter plans', () => {
  it('plays the sheet itself, once, with its HP as it stands', () => {
    const npc = captain()
    const hurt = { ...npc, state: { ...npc.state, currentHp: 40 } }
    const plan = { id: 'p', name: 'Docks', monsters: [{ ...npcPlanEntry(npc), count: 1 }] }
    let n = 0
    const rows = planCombatants(plan, [], () => `r${++n}`, { d20: bonus => 10 + bonus }, [hurt])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'Captain Vexa', npcId: 'vexa', initiative: 13, hp: { current: 40, max: 65 } })
    expect(npcPlanEntry(npc)).toMatchObject({ monsterId: 'vexa', source: 'npc', xp: 450, cr: 2 })
  })
})
