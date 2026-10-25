// Pure helpers for table mode: the keypad and the list of spendable tracks.
import type { Character } from '../model/character'
import { getResources, getSpellSlots } from '../rules'
import { setPactUsed, setResourceUsed, setSlotUsed, upsertCounter } from '../sheet/engine'

/** Largest amount the keypad accepts. Bigger hits are rare enough to type twice. */
export const KEYPAD_MAX = 999

/** Applies one keypad press to the typed amount ('' means nothing typed). */
export function pressKey(amount: string, key: string): string {
  if (key === 'clear') return ''
  if (key === 'back') return amount.slice(0, -1)
  if (!/^\d$/.test(key)) return amount
  const next = (amount + key).replace(/^0+/, '')
  return Number(next) > KEYPAD_MAX ? amount : next
}

export interface Track {
  id: string
  label: string
  remaining: number
  max: number
  /** Spends one use, or gives one back with delta -1. */
  change: (c: Character, delta: 1 | -1) => Character
}

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** Spell slots, pact slots, class resources and custom trackers, in that order. */
export function tracks(c: Character): Track[] {
  const out: Track[] = []
  const { slots, pact } = getSpellSlots(c)
  const s = c.state
  slots.forEach((max, i) => {
    if (max <= 0) return
    const used = s.spellSlotsUsed[i] ?? 0
    out.push({ id: `slot-${i + 1}`, label: `${ORDINAL[i]} slot`, remaining: max - used, max,
      change: (x, d) => setSlotUsed(x, i + 1, (x.state.spellSlotsUsed[i] ?? 0) + d) })
  })
  if (pact) {
    out.push({ id: 'pact', label: `Pact (${ORDINAL[pact.level - 1]})`, remaining: pact.count - s.pactSlotsUsed, max: pact.count,
      change: (x, d) => setPactUsed(x, x.state.pactSlotsUsed + d) })
  }
  for (const r of getResources(c)) {
    const used = s.resources[r.id]?.used ?? 0
    out.push({ id: r.id, label: r.label, remaining: r.max - used, max: r.max,
      change: (x, d) => setResourceUsed(x, r.id, (x.state.resources[r.id]?.used ?? 0) + d) })
  }
  for (const k of s.counters ?? []) {
    out.push({ id: k.id, label: k.label, remaining: k.max - k.used, max: k.max,
      change: (x, d) => {
        const cur = (x.state.counters ?? []).find(n => n.id === k.id)
        return cur ? upsertCounter(x, { ...cur, used: cur.used + d }) : x
      } })
  }
  return out
}
