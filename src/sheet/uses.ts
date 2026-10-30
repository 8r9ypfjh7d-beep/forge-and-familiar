// Using a feature or an item from the sheet: spend one use (or one potion), heal, and start its
// running effect (Rage). Pure, like engine.ts; the plans come from rules/usables.ts.
import type { Character } from '../model/character'
import { setQty } from '../inventory/inventory'
import type { UsePlan } from '../rules'
import { grantTempHp, heal, setResourceUsed } from './engine'
import { startEffect } from './effects'

/** One use of a resource: spent, then the plan's effect, temp HP and healing. Using one with none left still applies (warn, don't block). */
export function spendResource(c: Character, id: string, plan: UsePlan, rolled: { heal?: number; tempHp?: number } = {}): Character {
  let next = setResourceUsed(c, id, (c.state.resources[id]?.used ?? 0) + 1)
  if (plan.effect) next = startEffect(next, plan.effect).character
  if (rolled.tempHp) next = grantTempHp(next, rolled.tempHp)
  if (rolled.heal) next = heal(next, rolled.heal)
  return next
}

/** Drinks one potion from a stack: one fewer, and the healing it rolled. */
export function drinkPotion(c: Character, uid: string, healed: number): Character {
  const entry = c.inventory.find(e => e.uid === uid)
  if (!entry) return c
  return heal(setQty(c, uid, entry.qty - 1), healed)
}
