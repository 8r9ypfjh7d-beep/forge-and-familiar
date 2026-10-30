// Ammunition and food countdowns, driven by inventory stacks.
// Pure: each change takes a Character and returns a new one, like sheet/engine.
// Rules follow SRD 5.1: Ammunition (weapon property), Food and Water.
import type { Character, CharacterState } from '../model/character'
import { abilityMod, entryItem, getAbilityScores, itemById, packRations, rulesEdition, type Attack, type InventoryEntry, type Item } from '../rules'

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

/** The ammunition an attack from derive().attacks fires, if its weapon uses any (Shortbow → arrows). */
export function ammoForAttack(c: Character, a: Pick<Attack, 'name' | 'itemId'>): RangedWeapon | undefined {
  const ranged = rangedWeapons(c)
  return ranged.find(r => a.itemId && r.weapon.id === a.itemId) ?? ranged.find(r => r.weapon.name === a.name)
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

/** Days a character can go without food before it becomes a problem: 3 + CON modifier, at least 1. */
export function foodLimit(c: Character): number {
  return Math.max(1, 3 + abilityMod(getAbilityScores(c).con))
}

/** Rations still inside carried equipment packs (an Explorer's Pack holds 10 days), less those eaten from them. */
function packRationsLeft(c: Character): number {
  const packed = c.inventory.reduce((n, e) => n + packRations(e.itemId, rulesEdition(c)) * e.qty, 0)
  return Math.max(0, packed - (supplies(c).packRationsUsed ?? 0))
}

/** Days of food carried: loose rations plus the ones still in a pack. */
export function rationsLeft(c: Character): number {
  return countOf(c, RATION_ID) + packRationsLeft(c)
}

/** Eats one day of rations: a loose ration first, then one from a pack. */
function eatRation(c: Character, patch: Partial<Supplies>): Character {
  if (countOf(c, RATION_ID) > 0) return withSupplies(c, patch, take(c.inventory, RATION_ID, 1))
  return withSupplies(c, { ...patch, packRationsUsed: (supplies(c).packRationsUsed ?? 0) + 1 })
}

export function daysWithoutFood(c: Character): number {
  return supplies(c).daysWithoutFood ?? 0
}

/**
 * Settles the day's food after a long rest (one long rest = one day).
 * Pass the character before and after sheet/engine longRest:
 * - a meal resets the hungry count; a ration comes out of the bag (loose ones before an equipment pack's);
 * - going hungry adds a day to the hungry count;
 * - ammunition nobody searched for is lost.
 */
export function endDay(before: Character, rested: Character, meal: Meal): Character {
  if (rested === before) return rested
  let c = forgetSpentAmmo(rested)
  if (meal === 'ration' && rationsLeft(c) <= 0) meal = 'none'
  if (meal === 'ration') return eatRation(c, { daysWithoutFood: 0 })
  if (meal === 'other') return withSupplies(c, { daysWithoutFood: 0 })
  return withSupplies(c, { daysWithoutFood: daysWithoutFood(c) + 1 })
}

/** The long-rest dialog suggests a ration when there is one; tables that skip food tracking never go hungry by default. */
export function defaultMeal(c: Character): Meal {
  return rationsLeft(c) > 0 ? 'ration' : 'other'
}
