// Inspiration and rewards through the party stash, like XP awards (xp.ts): the giver writes a gift,
// and each player's device adds it to the character they brought, once. Pure, no React or storage.
import type { Boon, Character } from '../model/character'
import { addBoon, gainInspiration } from '../sheet/boons'
import type { Gift, GiftBoon, Party } from './types'
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
  return next
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
