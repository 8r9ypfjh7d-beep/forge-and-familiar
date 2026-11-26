// How the d20s in a roll history compare with a fair die. Pure.
import type { RollResult } from './types'

export type D20Verdict = 'none' | 'normal' | 'low' | 'high'

export interface D20Stats {
  /** Every physical d20 thrown, kept or dropped (both dice of advantage, a Lucky reroll). */
  n: number
  average: number
  nat1: number
  nat20: number
  /** Expected count of each face: n / 20. */
  expected: number
  /** How far the average is from 10.5, in standard errors. 0 when n is 0. */
  z: number
  /** 'none' under 20 dice; otherwise 'normal' inside |z| < 2.58 (99%), else 'low' or 'high'. */
  verdict: D20Verdict
}

const FAIR_MEAN = 10.5
const FAIR_SD = Math.sqrt(33.25) // (20^2 - 1) / 12

export function d20Stats(rolls: readonly RollResult[]): D20Stats {
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
  const z = n ? (average - FAIR_MEAN) / (FAIR_SD / Math.sqrt(n)) : 0
  const verdict: D20Verdict = n < 20 ? 'none' : Math.abs(z) < 2.58 ? 'normal' : z < 0 ? 'low' : 'high'
  return { n, average, nat1, nat20, expected: n / 20, z, verdict }
}
