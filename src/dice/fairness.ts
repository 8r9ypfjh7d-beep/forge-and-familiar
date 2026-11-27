// How the d20s in a roll history compare with the die they came from (fair, or a player's leaned d20). Pure.
import { leanProbability } from './rng'
import type { RollResult } from './types'

export type D20Verdict = 'none' | 'normal' | 'low' | 'high'

export interface D20Stats {
  /** Every physical d20 thrown, kept or dropped (both dice of advantage, a Lucky reroll). */
  n: number
  average: number
  nat1: number
  nat20: number
  /** Expected average: 10.5 fair, 11.4375 leaned. */
  expectedAverage: number
  /** Expected natural 1s and 20s for n dice (n / 20 each when fair). */
  expectedNat1: number
  expectedNat20: number
  /** How far the average is from the expected average, in standard errors. 0 when n is 0. */
  z: number
  /** 'none' under 20 dice; otherwise 'normal' inside |z| < 2.58 (99%), else 'low' or 'high'. */
  verdict: D20Verdict
}

const FACES = Array.from({ length: 20 }, (_, i) => i + 1)

function d20Model(lean: boolean) {
  const p = (v: number) => (lean ? leanProbability(20, v) : 1 / 20)
  const mean = FACES.reduce((s, v) => s + v * p(v), 0)
  const variance = FACES.reduce((s, v) => s + (v - mean) ** 2 * p(v), 0)
  return { mean, sd: Math.sqrt(variance), p1: p(1), p20: p(20) }
}

const FAIR = d20Model(false) // mean 10.5, variance 33.25
const LEAN = d20Model(true) // mean 11.4375

/** `lean`: the history's dice came from leanRng (a player's), so compare with that distribution. */
export function d20Stats(rolls: readonly RollResult[], lean = false): D20Stats {
  const m = lean ? LEAN : FAIR
  let n = 0, sum = 0, nat1 = 0, nat20 = 0
  for (const r of rolls)
    for (const t of r.terms) {
      if (t.kind !== 'dice') continue
      for (const d of t.rolls) {
        if (d.sides !== 20) continue
        n++
        sum += d.value
        if (d.value === 1) nat1++
        if (d.value === 20) nat20++
      }
    }
  const average = n ? sum / n : 0
  const z = n ? (average - m.mean) / (m.sd / Math.sqrt(n)) : 0
  const verdict: D20Verdict = n < 20 ? 'none' : Math.abs(z) < 2.58 ? 'normal' : z < 0 ? 'low' : 'high'
  return { n, average, nat1, nat20, expectedAverage: m.mean, expectedNat1: n * m.p1, expectedNat20: n * m.p20, z, verdict }
}
