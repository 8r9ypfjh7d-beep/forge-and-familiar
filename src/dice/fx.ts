// Roll effects: which die to animate for a roll, and the natural 20 / natural 1 full-screen moments. Pure TS; the overlays are ui/RollFx.tsx and ui/CritFx.tsx.
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

/** The kept dice of a roll that has no d20 metadata (a tray roll). */
const keptDice = (r: RollResult) => r.terms.flatMap(t => (t.kind === 'dice' ? t.rolls.filter(d => d.kept) : []))

/** The kept d20 shows `face`: on a d20 roll, or a lone d20 rolled from the tray ("d20", "d20+3"). */
function naturalIs(r: RollResult, face: number): boolean {
  if (r.d20) return r.d20.natural === face
  const dice = keptDice(r)
  return dice.length === 1 && dice[0].sides === 20 && dice[0].value === face
}

export const isNat20 = (r: RollResult): boolean => naturalIs(r, 20)
export const isNat1 = (r: RollResult): boolean => naturalIs(r, 1)

/** Which full-screen moment a roll earns, if any. */
export type CritKind = 'nat20' | 'nat1'
export function critKind(r: RollResult): CritKind | null {
  return isNat20(r) ? 'nat20' : isNat1(r) ? 'nat1' : null
}

/** How a roll was recorded. Quiet rolls (the DM rolling for monsters and NPCs) tumble and land but never take over the screen. */
export interface RecordOptions {
  quiet?: boolean
}

/** The full-screen moment a recorded roll shows: none for quiet rolls. */
export const fxCritKind = (r: RollResult, opts?: RecordOptions): CritKind | null => (opts?.quiet ? null : critKind(r))

/** How many lines each moment has; keys are dice.nat20.line1..N and dice.nat1.line1..N in both locales. */
export const NAT20_LINES = 8
export const NAT1_LINES = 8
export const CRIT_LINES: Record<CritKind, number> = { nat20: NAT20_LINES, nat1: NAT1_LINES }

/** Picks a line index in 1..count, never the same as `last` so a streak stays fresh. */
export function pickLine(random: () => number, count: number, last = 0): number {
  if (!last || count < 2) return 1 + Math.floor(random() * count)
  const n = 1 + Math.floor(random() * (count - 1))
  return n >= last ? n + 1 : n
}

export const pickNat20Line = (random: () => number, last = 0): number => pickLine(random, NAT20_LINES, last)

/**
 * Collects rolls recorded in one tap (an attack records to-hit then damage) and reports the one to animate:
 * the first d20 roll of the burst, else the first roll. A burst ends when `windowMs` passes without a new roll.
 */
export class RollFxBus {
  private listeners = new Set<(r: RollResult, opts: RecordOptions) => void>()
  private shown: { roll: RollResult; at: number } | null = null

  private windowMs: number
  private now: () => number

  constructor(windowMs = 150, now: () => number = Date.now) {
    this.windowMs = windowMs
    this.now = now
  }

  push(r: RollResult, opts: RecordOptions = {}): void {
    const at = this.now()
    const prev = this.shown
    if (prev && at - prev.at < this.windowMs) {
      prev.at = at
      if (prev.roll.d20 || !r.d20) return
    }
    this.shown = { roll: r, at }
    this.listeners.forEach(l => l(r, opts))
  }

  subscribe = (l: (r: RollResult, opts: RecordOptions) => void): (() => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
}
