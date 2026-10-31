// Spending sorcery points (Metamagic, Font of Magic) across the character's pools, and Font of Magic's
// slot conversions. Pure functions over a Character, like engine.ts.
import type { Character } from '../model/character'
import { FONT_SLOT_COST, SORCERY_POOLS, getResources, getSpellSlots } from '../rules'
import { setResourceUsed, setSlotUsed } from './engine'

/** Each sorcery point pool the character has, with what is left. */
export function sorceryPools(c: Character): { id: string; label: string; max: number; used: number }[] {
  const all = getResources(c)
  return SORCERY_POOLS.flatMap(id => {
    const r = all.find(x => x.id === id)
    return r ? [{ id, label: r.label, max: r.max, used: c.state.resources[id]?.used ?? 0 }] : []
  })
}

export const sorceryLeft = (c: Character) => sorceryPools(c).reduce((n, p) => n + p.max - p.used, 0)

/** Pays `cost` points, class pool first. Undefined when there are not enough. */
export function spendSorcery(c: Character, cost: number): Character | undefined {
  if (cost > sorceryLeft(c)) return undefined
  let due = cost
  let out = c
  for (const p of sorceryPools(c)) {
    const take = Math.min(due, p.max - p.used)
    if (take > 0) out = setResourceUsed(out, p.id, p.used + take)
    due -= take
  }
  return out
}

const slotLeft = (c: Character, level: number) => (getSpellSlots(c).slots[level - 1] ?? 0) - (c.state.spellSlotsUsed[level - 1] ?? 0)

/** Font of Magic: get back an expended slot of level 1-5 for its point cost. Undefined when not possible. */
export function createSlot(c: Character, level: number): Character | undefined {
  const cost = FONT_SLOT_COST[level - 1]
  const used = c.state.spellSlotsUsed[level - 1] ?? 0
  if (!cost || used === 0) return undefined
  const paid = spendSorcery(c, cost)
  return paid && setSlotUsed(paid, level, used - 1)
}

/** Font of Magic: spend an unused slot for as many sorcery points as its level, into the class pool (up to its maximum). */
export function slotToPoints(c: Character, level: number): Character | undefined {
  const pool = sorceryPools(c).find(p => p.id === 'sorcery-points')
  if (!pool || pool.used === 0 || slotLeft(c, level) <= 0) return undefined
  const spent = setSlotUsed(c, level, (c.state.spellSlotsUsed[level - 1] ?? 0) + 1)
  return setResourceUsed(spent, pool.id, pool.used - level)
}
