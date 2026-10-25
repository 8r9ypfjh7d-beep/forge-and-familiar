// Inventory changes: add library or custom items, quantities, equip, pact weapon, item edits, coins.
// Pure: each function returns a new Character for the sheet's apply().
import { LIBRARY_ID_FOR_RULES_ITEM, toRulesItem, type Equipment, type MagicItem } from '../content'
import type { Character } from '../model/character'
import { entryItem, itemById, type InventoryEntry, type Item } from '../rules'

const RULES_ID_FOR_LIBRARY = Object.fromEntries(Object.entries(LIBRARY_ID_FOR_RULES_ITEM).map(([rules, lib]) => [lib, rules]))

export const newUid = () => `inv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** The fields an entry needs for a library item: the engine's own id when it has the item, else the item embedded. */
export function fromLibrary(e: Equipment): Pick<InventoryEntry, 'itemId' | 'item'> {
  const rulesId = RULES_ID_FOR_LIBRARY[e.id] ?? e.id
  const known = itemById(rulesId)
  if (known && known.kind === (e.weapon ? 'weapon' : e.armor ? 'armor' : 'gear')) return { itemId: rulesId }
  const item: Item = toRulesItem(e) ?? { kind: 'gear', id: e.id, name: e.name, weight: e.weight ?? 0 }
  if (item.kind === 'gear' && !item.description && e.description) item.description = e.description
  return { itemId: e.id, item }
}

/** "+2" in "Weapon, +2" or "Shield +1". */
export const magicBonusOf = (name: string) => Number(/\+([1-3])\b/.exec(name)?.[1] ?? 0)

/** A magic item as an entry. Its rules text goes in notes, where the player can edit it. Weapons and armor need a base item: see `withBase`. */
export function fromMagicItem(m: MagicItem): Omit<InventoryEntry, 'uid' | 'qty' | 'equipped'> {
  return {
    itemId: m.id,
    item: { kind: 'gear', id: m.id, name: m.name, weight: 0 },
    notes: m.description,
    ...(magicBonusOf(m.name) ? { magicBonus: magicBonusOf(m.name) } : {}),
  }
}

/** A magic weapon or armor built on a base item: the base's stats under the magic item's name and id. */
export const withBase = (base: Item, name: string, id: string): Item => ({ ...base, id, name })

const isPlain = (e: Pick<InventoryEntry, 'item' | 'name' | 'notes' | 'magicBonus' | 'pact' | 'extraDamage'>) =>
  !e.item && !e.name && !e.notes && !e.magicBonus && !e.pact && !e.extraDamage

/** Adds an item. A plain SRD item stacks onto a plain stack of the same item; anything customised gets its own line. */
export function addItem(c: Character, fields: Omit<InventoryEntry, 'uid' | 'qty' | 'equipped'>, qty = 1): { character: Character; uid: string } {
  const stack = isPlain(fields) ? c.inventory.find(e => e.itemId === fields.itemId && isPlain(e)) : undefined
  if (stack) return { character: setQty(c, stack.uid, stack.qty + qty), uid: stack.uid }
  const uid = newUid()
  return { character: { ...c, inventory: [...c.inventory, { uid, qty, equipped: false, ...fields }] }, uid }
}

export function updateEntry(c: Character, uid: string, patch: Partial<Omit<InventoryEntry, 'uid'>>): Character {
  let inventory = c.inventory.map(e => (e.uid === uid ? clean({ ...e, ...patch }) : e))
  // Only one pact weapon at a time.
  if (patch.pact) inventory = inventory.map(e => (e.uid !== uid && e.pact ? clean({ ...e, pact: undefined }) : e))
  return { ...c, inventory }
}

/** Drops empty optional fields so saves stay small. */
function clean(e: InventoryEntry): InventoryEntry {
  const out = { ...e }
  for (const k of ['name', 'notes', 'magicBonus', 'pact', 'extraDamage', 'item'] as const) {
    const v = out[k]
    if (v === undefined || v === '' || v === 0 || v === false) delete out[k]
  }
  return out
}

export const removeEntry = (c: Character, uid: string): Character => ({ ...c, inventory: c.inventory.filter(e => e.uid !== uid) })

export function setQty(c: Character, uid: string, qty: number): Character {
  if (qty <= 0) return removeEntry(c, uid)
  return { ...c, inventory: c.inventory.map(e => (e.uid === uid ? { ...e, qty } : e)) }
}

export const setEquipped = (c: Character, uid: string, equipped: boolean): Character =>
  ({ ...c, inventory: c.inventory.map(e => (e.uid === uid ? { ...e, equipped } : e)) })

export type Coin = keyof Character['coins']
export const COINS: Coin[] = ['gp', 'sp', 'cp']

export const setCoins = (c: Character, coin: Coin, value: number): Character =>
  ({ ...c, coins: { ...c.coins, [coin]: Math.max(0, Math.floor(value) || 0) } })

export const isWarlock = (c: Pick<Character, 'classes'>) => c.classes.some(x => x.classId === 'warlock')

/** Display item for an entry, or a stand-in so an unknown id still shows. */
export const itemOf = (e: InventoryEntry): Item => entryItem(e) ?? { kind: 'gear', id: e.itemId, name: e.name ?? e.itemId, weight: 0 }
