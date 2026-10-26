// Roll effects: which die to animate for a roll, and the natural 20 easter egg. Pure TS; the overlay is ui/RollFx.tsx.
import type { RollResult } from './types'

/** The die face the animation lands on: the d20 for d20 rolls, otherwise the first die rolled. */
export interface DieFace {
  sides: number
  value: number
}

export function headlineDie(r: RollResult): DieFace | null {
  if (r.d20) return { sides: 20, value: r.d20.natural }
  for (const t of r.terms) {
    if (t.kind !== 'dice') continue
    const kept = t.rolls.find(d => d.kept) ?? t.rolls[0]
    if (kept) return { sides: kept.sides, value: kept.value }
  }
  return null
}

/** A natural 20: the kept d20 on a d20 roll, or a lone d20 rolled from the tray ("d20", "d20+3"). */
export function isNat20(r: RollResult): boolean {
  if (r.d20) return r.d20.natural === 20
  const dice = r.terms.flatMap(t => (t.kind === 'dice' ? t.rolls.filter(d => d.kept) : []))
  return dice.length === 1 && dice[0].sides === 20 && dice[0].value === 20
}

/** How many funny natural 20 lines exist; keys are dice.nat20.line1..N in both locales. */
export const NAT20_LINES = 8

/** Picks a line index in 1..NAT20_LINES, never the same as `last` so a lucky streak stays fresh. */
export function pickNat20Line(random: () => number, last = 0): number {
  if (!last) return 1 + Math.floor(random() * NAT20_LINES)
  const n = 1 + Math.floor(random() * (NAT20_LINES - 1))
  return n >= last ? n + 1 : n
}

/**
 * Collects rolls recorded in one tap (an attack records to-hit then damage) and reports the one to animate:
 * the first d20 roll of the burst, else the first roll. A burst ends when `windowMs` passes without a new roll.
 */
export class RollFxBus {
  private listeners = new Set<(r: RollResult) => void>()
  private shown: { roll: RollResult; at: number } | null = null

  private windowMs: number
  private now: () => number

  constructor(windowMs = 150, now: () => number = Date.now) {
    this.windowMs = windowMs
    this.now = now
  }

  push(r: RollResult): void {
    const at = this.now()
    const prev = this.shown
    if (prev && at - prev.at < this.windowMs) {
      prev.at = at
      if (prev.roll.d20 || !r.d20) return
    }
    this.shown = { roll: r, at }
    this.listeners.forEach(l => l(r))
  }

  subscribe = (l: (r: RollResult) => void): (() => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
}
