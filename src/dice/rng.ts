// The one source of randomness for game-facing rolls: crypto.getRandomValues, no Math.random fallback.

const TWO_32 = 0x1_0000_0000

function draw(): number {
  const c = globalThis.crypto
  if (!c?.getRandomValues) throw new Error('Secure random numbers are unavailable: crypto.getRandomValues is missing')
  const buf = new Uint32Array(1)
  c.getRandomValues(buf)
  return buf[0]
}

/** A uniform integer in 0..n-1. Rejection sampling keeps every value equally likely. */
export function randomInt(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > TWO_32) throw new RangeError(`randomInt: n must be an integer in 1..2^32, got ${n}`)
  const limit = Math.floor(TWO_32 / n) * n
  let v = draw()
  while (v >= limit) v = draw()
  return v % n
}

/** A uniform float in [0, 1), from one 32-bit crypto value. */
export const randomFloat = (): number => draw() / TWO_32

/** Player dice lean high: how often a die in the bottom quarter is rerolled once. */
export const LEAN_CHANCE = 0.5

/** The top face of a die's bottom quarter (1..5 on a d20), at least 1. */
export const leanLow = (sides: number): number => Math.max(1, Math.floor(sides / 4))

/**
 * A 1..sides roll that leans high: a fair roll in the bottom quarter is, half the time,
 * rerolled once fairly and the new value stands.
 */
export function leanInt(sides: number): number {
  const v = 1 + randomInt(sides)
  if (v <= leanLow(sides) && randomInt(2) === 0) return 1 + randomInt(sides)
  return v
}

/** Exact chance that `leanInt(sides)` returns `v`. On a d20: 3.125% for 1..5, 5.625% for 6..20. */
export function leanProbability(sides: number, v: number): number {
  if (!Number.isInteger(v) || v < 1 || v > sides) return 0
  const low = leanLow(sides)
  const again = LEAN_CHANCE * low / (sides * sides)
  return v <= low ? (1 - LEAN_CHANCE) / sides + again : 1 / sides + again
}
