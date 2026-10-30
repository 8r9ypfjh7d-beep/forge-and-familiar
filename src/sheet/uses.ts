// Using a feature or an item from the sheet: spend one use (or one potion), heal, and start its
// running effect (Rage). Pure, like engine.ts; the plans come from rules/usables.ts.
import type { BeastForm, Character, LiveEffect } from '../model/character'
import { setQty } from '../inventory/inventory'
import type { UsePlan } from '../rules'
import { grantTempHp, heal, setPactUsed, setResourceUsed, setSlotUsed } from './engine'
import { startEffect } from './effects'

/** One use of a resource: spent, then the plan's effect, temp HP and healing. Using one with none left still applies (warn, don't block). */
/** What the player rolled or picked for a use: healing, temp HP, and the spent slot levels picked back (Arcane Recovery, one entry per slot). */
export interface Rolled { heal?: number; tempHp?: number; slots?: number[] }

export function spendResource(c: Character, id: string, plan: UsePlan, rolled: Rolled = {}, n = 1): Character {
  return applyUse(setResourceUsed(c, id, (c.state.resources[id]?.used ?? 0) + n), plan, rolled)
}

/**
 * What a use does besides spending: its effect, temp HP, healing, pact slots back (Magical Cunning), picked slots back
 * (Arcane Recovery) and a pool refilled (Uncanny Metabolism). Features without uses (Dark One's Blessing) only do this.
 */
export function applyUse(c: Character, plan: UsePlan, rolled: Rolled = {}): Character {
  let next = plan.pactSlots ? setPactUsed(c, (c.state.pactSlotsUsed ?? 0) - plan.pactSlots) : c
  for (const level of rolled.slots ?? []) next = setSlotUsed(next, level, (next.state.spellSlotsUsed[level - 1] ?? 0) - 1)
  if (plan.refill) next = setResourceUsed(next, plan.refill, 0)
  if (plan.effect) next = startEffect(next, plan.effect).character
  if (rolled.tempHp) next = grantTempHp(next, rolled.tempHp)
  if (rolled.heal) next = heal(next, rolled.heal)
  return next
}

/**
 * Arcane Recovery's picks: one entry per slot level taken back. Only spent slots, none above `maxLevel`,
 * and the levels add up to `budget` at most.
 */
export function recoverableSlots(c: Character, slots: number[], maxLevel: number): number[] {
  return slots.slice(0, maxLevel).map((max, i) => Math.min(max, c.state.spellSlotsUsed[i] ?? 0))
}

export function fitsBudget(picked: number[], budget: number): boolean {
  return picked.reduce((n, level) => n + level, 0) <= budget
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
