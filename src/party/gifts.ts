// Inspiration and rewards through the party stash, like XP awards (xp.ts): the giver writes a gift,
// and each player's device adds it to the character they brought, once. Pure, no React or storage.
import type { Boon, Character } from '../model/character'
import { itemById } from '../rules'
import { addBoon, gainInspiration } from '../sheet/boons'
import type { Coins, Gift, GiftBoon, Party } from './types'
import { AWARD_LIMIT } from './xp'

export const GIFT_LIMIT = 50

/** Gifts for `userId`'s character `characterId`, oldest first. */
export function giftsFor(party: Party, userId: string, characterId: string): Gift[] {
  return (party.stash?.gifts ?? [])
    .filter(g => g.to.some(x => x.userId === userId && x.characterId === characterId))
    .sort((a, b) => a.at.localeCompare(b.at))
}

/** The character's own copy of a gift's reward. */
export const boonFromGift = (g: Gift, boon: GiftBoon): Boon => ({ ...boon, id: g.id, at: g.at, ...(g.byName ? { from: g.byName } : {}) })

/** Adds one gift and remembers its id (with the XP awards, which share the list). */
export function addGift(c: Character, g: Gift): Character {
  let next: Character = { ...c, appliedAwards: [...(c.appliedAwards ?? []), g.id].slice(-AWARD_LIMIT * 2) }
  if (g.inspiration) next = gainInspiration(next)
  if (g.boon) next = addBoon(next, boonFromGift(g, g.boon))
  if (g.coins) next = { ...next, coins: payPurse(next.coins, g.coins) }
  if (g.dropItem) next = { ...next, inventory: next.inventory.filter(e => e.stashId !== g.dropItem) }
  if (g.item) {
    const { stashId, name, qty, itemId, note } = g.item
    const entry = itemId && itemById(itemId)
      ? { itemId }
      : { itemId: `stash-${stashId}`, item: { kind: 'gear' as const, id: `stash-${stashId}`, name, weight: 0 } }
    next = { ...next, inventory: [...next.inventory.filter(e => e.stashId !== stashId),
      { uid: `inv-${g.id.slice(0, 12)}`, qty, equipped: false, ...entry, ...(note ? { notes: note } : {}), stashId }] }
  }
  return next
}

type Purse = Character['coins']
const purseCp = (p: Purse) => p.gp * 100 + p.sp * 10 + p.cp

/**
 * Coins in or out of a purse that holds only gp, sp and cp: platinum counts as 10 gp and electrum as 5 sp.
 * Paying out makes change from bigger coins when needed; a purse that can't cover it ends at zero.
 */
export function payPurse(purse: Purse, delta: Partial<Coins>): Purse {
  const d = { gp: (delta.gp ?? 0) + (delta.pp ?? 0) * 10, sp: (delta.sp ?? 0) + (delta.ep ?? 0) * 5, cp: delta.cp ?? 0 }
  const next = { gp: purse.gp + d.gp, sp: purse.sp + d.sp, cp: purse.cp + d.cp }
  if (next.gp >= 0 && next.sp >= 0 && next.cp >= 0) return next
  const total = purseCp(purse) + d.gp * 100 + d.sp * 10 + d.cp
  if (total <= 0) return { gp: 0, sp: 0, cp: 0 }
  // Break bigger coins for change: silver for copper, gold for silver.
  if (next.cp < 0) { const n = Math.ceil(-next.cp / 10); next.sp -= n; next.cp += n * 10 }
  if (next.sp < 0) { const n = Math.ceil(-next.sp / 10); next.gp -= n; next.sp += n * 10 }
  if (next.gp >= 0) return next
  // Short on gold: pay it in silver when there is enough.
  if (next.sp + next.gp * 10 >= 0) return { gp: 0, sp: next.sp + next.gp * 10, cp: next.cp }
  return { gp: Math.floor(total / 100), sp: Math.floor((total % 100) / 10), cp: total % 10 }
}

/** The character with every gift from its parties it hasn't taken yet; the same object when there is none. */
export function takeGifts(c: Character, parties: Party[]): Character {
  const done = new Set(c.appliedAwards ?? [])
  const fresh = parties.flatMap(p => giftsFor(p, c.ownerId, c.id)).filter(g => !done.has(g.id))
  return fresh.reduce(addGift, c)
}

/** A reward the DM can hand out: a name, and a charm needs at least one use. */
export function cleanGiftBoon(b: GiftBoon): GiftBoon | null {
  const name = b.name.trim()
  if (!name) return null
  const text = b.text?.trim() || undefined
  if (b.kind === 'blessing') return { kind: 'blessing', name, ...(text ? { text } : {}), ...(b.stats?.length ? { stats: b.stats } : {}) }
  const uses = Math.min(20, Math.max(1, Math.floor(b.uses ?? 1)))
  return { kind: 'charm', name, uses, ...(text ? { text } : {}), ...(b.roll ? { roll: b.roll } : {}) }
}
