// Using a feature or an item from the sheet: spend one use (or one potion), heal, and start its
// running effect (Rage). Pure, like engine.ts; the plans come from rules/usables.ts.
import type { BeastForm, Character, LiveEffect } from '../model/character'
import { setQty } from '../inventory/inventory'
import type { UsePlan } from '../rules'
import { grantTempHp, heal, setPactUsed, setResourceUsed } from './engine'
import { startEffect } from './effects'

/** One use of a resource: spent, then the plan's effect, temp HP and healing. Using one with none left still applies (warn, don't block). */
export function spendResource(c: Character, id: string, plan: UsePlan, rolled: { heal?: number; tempHp?: number } = {}, n = 1): Character {
  return applyUse(setResourceUsed(c, id, (c.state.resources[id]?.used ?? 0) + n), plan, rolled)
}

/** What a use does besides spending: its effect, temp HP, healing and pact slots back (Magical Cunning). Features without uses (Dark One's Blessing) only do this. */
export function applyUse(c: Character, plan: UsePlan, rolled: { heal?: number; tempHp?: number } = {}): Character {
  let next = plan.pactSlots ? setPactUsed(c, (c.state.pactSlotsUsed ?? 0) - plan.pactSlots) : c
  if (plan.effect) next = startEffect(next, plan.effect).character
  if (rolled.tempHp) next = grantTempHp(next, rolled.tempHp)
  if (rolled.heal) next = heal(next, rolled.heal)
  return next
}

/** Wild Shape into a beast: the use's effect carries the form, so Effects shows its AC, HP, speed and attacks. */
export function withForm(plan: UsePlan, form: BeastForm): UsePlan {
  return plan.effect ? { ...plan, effect: { ...plan.effect, form } } : plan
}

/** Drinks one potion from a stack: one fewer, the healing it rolled, and its effect running for its duration. */
export function drinkPotion(c: Character, uid: string, healed: number, effect?: Omit<LiveEffect, 'on'>): Character {
  const entry = c.inventory.find(e => e.uid === uid)
  if (!entry) return c
  let next = heal(setQty(c, uid, entry.qty - 1), healed)
  if (effect) next = startEffect(next, effect).character
  return next
}
