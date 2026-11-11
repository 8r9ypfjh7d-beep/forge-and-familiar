// Vitality rings: hit points, spell slots and hit dice as three concentric rings, read at a glance.
import type { Character } from '../model/character'
import { getSpellSlots } from '../rules'
import { effectiveMaxHp, hitDiceRemaining } from './engine'

export type RingKind = 'hp' | 'slots' | 'hitDice'
export interface Ring { kind: RingKind; value: number; max: number }

/** The rings to draw, outermost first. Slots are left out for a character with none. */
export function vitalityRings(c: Character): Ring[] {
  const rings: Ring[] = [{ kind: 'hp', value: Math.max(0, c.state.currentHp), max: effectiveMaxHp(c) }]
  const { slots, pact } = getSpellSlots(c)
  const used = c.state.spellSlotsUsed ?? []
  const slotMax = slots.reduce((a, n) => a + n, 0) + (pact?.count ?? 0)
  if (slotMax > 0) {
    const slotLeft = slots.reduce((a, n, i) => a + Math.max(0, n - (used[i] ?? 0)), 0) + Math.max(0, (pact?.count ?? 0) - (c.state.pactSlotsUsed ?? 0))
    rings.push({ kind: 'slots', value: slotLeft, max: slotMax })
  }
  const dice = hitDiceRemaining(c)
  rings.push({ kind: 'hitDice', value: dice.reduce((a, d) => a + Math.max(0, d.remaining), 0), max: dice.reduce((a, d) => a + d.total, 0) })
  return rings
}

/** How full a ring is, 0..1. */
export const ringFraction = (r: Ring) => (r.max > 0 ? Math.min(1, Math.max(0, r.value / r.max)) : 0)
