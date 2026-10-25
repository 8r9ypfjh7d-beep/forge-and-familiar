// Ammunition and food countdowns, driven by inventory stacks.
// Pure: each change takes a Character and returns a new one, like sheet/engine.
// Rules follow SRD 5.1: Ammunition (weapon property), Food and Water, Exhaustion.
import type { Character, CharacterState } from '../model/character'
import { abilityMod, entryItem, getAbilityScores, itemById, type InventoryEntry, type Item } from '../rules'
import { setExhaustion } from '../sheet/engine'

type Weapon = Extract<Item, { kind: 'weapon' }>
type Supplies = NonNullable<CharacterState['supplies']>

export const RATION_ID = 'rations'

/** Ammunition item for each SRD ammunition weapon. Homebrew bows and crossbows fall back on their name. */
const AMMO_BY_WEAPON: Record<string, string> = {
  shortbow: 'arrows', longbow: 'arrows',
  'light-crossbow': 'bolts', 'hand-crossbow': 'bolts', 'heavy-crossbow': 'bolts',
}

export function ammoFor(weapon: Weapon): string | undefined {
  if (!weapon.properties.includes('ammunition')) return undefined
  if (AMMO_BY_WEAPON[weapon.id]) return AMMO_BY_WEAPON[weapon.id]
  const name = weapon.name.toLowerCase()
  if (name.includes('crossbow')) return 'bolts'
  if (name.includes('bow')) return 'arrows'
  return undefined
}

/** How many of an item the character carries, across every stack. */
export function countOf(c: Character, itemId: string): number {
  return c.inventory.filter(e => e.itemId === itemId).reduce((n, e) => n + e.qty, 0)
}

export interface RangedWeapon {
  weapon: Weapon
  ammoId: string
  ammoName: string
  left: number
}

/** Equipped weapons that use ammunition, with the matching stack count. */
export function rangedWeapons(c: Character): RangedWeapon[] {
  const out: RangedWeapon[] = []
  for (const e of c.inventory) {
    const item = e.equipped ? entryItem(e) : undefined
    if (item?.kind !== 'weapon' || out.some(r => r.weapon.id === item.id)) continue
    const ammoId = ammoFor(item)
    if (ammoId) out.push({ weapon: item, ammoId, ammoName: itemById(ammoId)?.name ?? ammoId, left: countOf(c, ammoId) })
  }
  return out
}

function supplies(c: Character): Supplies {
  return c.state.supplies ?? {}
}

function withSupplies(c: Character, patch: Partial<Supplies>, inventory = c.inventory): Character {
  return { ...c, inventory, state: { ...c.state, supplies: { ...supplies(c), ...patch } } }
}

/** Takes n from the stacks of an item, last stack first. Empty stacks stay so recovery has somewhere to go. */
function take(inventory: InventoryEntry[], itemId: string, n: number): InventoryEntry[] {
  let left = n
  return [...inventory].reverse().map(e => {
    if (e.itemId !== itemId || left <= 0) return e
    const used = Math.min(e.qty, left)
    left -= used
    return { ...e, qty: e.qty - used }
  }).reverse()
}

function give(inventory: InventoryEntry[], itemId: string, n: number): InventoryEntry[] {
  const at = inventory.findIndex(e => e.itemId === itemId)
  if (at < 0) return [...inventory, { uid: `${itemId}-${Date.now().toString(36)}`, itemId, qty: n, equipped: false }]
  return inventory.map((e, i) => (i === at ? { ...e, qty: e.qty + n } : e))
}

// ---- Ammunition ----

/** Each attack with an ammunition weapon expends one piece. Returns c unchanged when out. */
export function spendAmmo(c: Character, ammoId: string, n = 1): Character {
  const used = Math.min(n, countOf(c, ammoId))
  if (used <= 0) return c
  const spent = supplies(c).ammoSpent ?? {}
  return withSupplies(c, { ammoSpent: { ...spent, [ammoId]: (spent[ammoId] ?? 0) + used } }, take(c.inventory, ammoId, used))
}

/** Pieces fired since the last search of the battlefield. */
export function ammoSpent(c: Character, ammoId: string): number {
  return supplies(c).ammoSpent?.[ammoId] ?? 0
}

/** After a fight, a minute of searching recovers half the expended ammunition (rounded down). */
export function recoverAmmo(c: Character): Character {
  const spent = supplies(c).ammoSpent ?? {}
  if (!Object.values(spent).some(n => n > 0)) return c
  let inventory = c.inventory
  for (const [id, n] of Object.entries(spent)) if (Math.floor(n / 2) > 0) inventory = give(inventory, id, Math.floor(n / 2))
  return withSupplies(c, { ammoSpent: {} }, inventory)
}

/** Shots that were never searched for are gone. */
export function forgetSpentAmmo(c: Character): Character {
  return Object.keys(supplies(c).ammoSpent ?? {}).length ? withSupplies(c, { ammoSpent: {} }) : c
}

// ---- Food ----

export type Meal = 'ration' | 'other' | 'none'

/** Days a character can go without food before exhaustion sets in: 3 + CON modifier, at least 1. */
export function foodLimit(c: Character): number {
  return Math.max(1, 3 + abilityMod(getAbilityScores(c).con))
}

export function daysWithoutFood(c: Character): number {
  return supplies(c).daysWithoutFood ?? 0
}

/**
 * Settles the day's food after a long rest (one long rest = one day).
 * Pass the character before and after sheet/engine longRest:
 * - a meal resets the hungry count; a ration comes out of the pack;
 * - going hungry undoes the rest's exhaustion relief (it needs food and drink)
 *   and, past the limit, adds one level of exhaustion;
 * - ammunition nobody searched for is lost.
 */
export function endDay(before: Character, rested: Character, meal: Meal): Character {
  if (rested === before) return rested
  let c = forgetSpentAmmo(rested)
  if (meal === 'ration' && countOf(c, RATION_ID) <= 0) meal = 'none'
  if (meal === 'ration') return withSupplies(c, { daysWithoutFood: 0 }, take(c.inventory, RATION_ID, 1))
  if (meal === 'other') return withSupplies(c, { daysWithoutFood: 0 })
  const days = daysWithoutFood(c) + 1
  c = withSupplies(c, { daysWithoutFood: days })
  const exhaustion = before.state.exhaustion + (days > foodLimit(c) ? 1 : 0)
  return exhaustion === c.state.exhaustion ? c : setExhaustion(c, exhaustion)
}

/** The long-rest dialog suggests a ration when there is one; tables that skip food tracking never go hungry by default. */
export function defaultMeal(c: Character): Meal {
  return countOf(c, RATION_ID) > 0 ? 'ration' : 'other'
}
