// The player's side of live-combat hits: damage or healing the DM dealt to a character that lives on
// this player's device. Pure: the hook in ui/useLiveHits.ts reads the live row and saves the result.
import type { Character } from '../model/character'
import { heal, takeDamage } from '../sheet/engine'
import type { Hit } from './types'

const APPLIED_LIMIT = 100

/** The character with every hit for it that it hasn't taken yet; the same object when there is none. */
export function takeHits(c: Character, hits: readonly Hit[] | undefined): Character {
  const done = new Set(c.appliedHits ?? [])
  const fresh = (hits ?? []).filter(h => h.characterId === c.id && !done.has(h.id))
  if (!fresh.length) return c
  const next = fresh.reduce((ch, h) => (h.kind === 'heal' ? heal(ch, h.amount) : takeDamage(ch, h.amount, { critical: h.critical })), c)
  return { ...next, appliedHits: [...(c.appliedHits ?? []), ...fresh.map(h => h.id)].slice(-APPLIED_LIMIT) }
}
