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
