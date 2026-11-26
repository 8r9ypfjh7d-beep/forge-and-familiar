import { afterEach, describe, expect, it, vi } from 'vitest'
import { d20Stats } from './fairness'
import { randomFloat, randomInt } from './rng'
import { roll, rollD20 } from './roll'
import type { RollResult } from './types'

const N = 200_000

/** Chi-square limit at p about 1e-6 (Wilson-Hilferty, z = 4.75), so a fair die never fails it. */
const limit = (df: number) => df * (1 - 2 / (9 * df) + 4.75 * Math.sqrt(2 / (9 * df))) ** 3

/** Chi-square statistic of `counts[v]` (v = 1..k) against probabilities `p(v)`. */
function chiSquare(counts: number[], p: (v: number) => number) {
  let chi = 0
  for (let v = 1; v < counts.length; v++) {
    const expected = N * p(v)
    chi += (counts[v] - expected) ** 2 / expected
  }
  return chi
}

describe('dice fairness (chi-square, 200,000 rolls each)', () => {
  it.each([4, 6, 8, 10, 12, 20, 100])('1d%i is uniform', sides => {
    const counts = new Array<number>(sides + 1).fill(0)
    for (let i = 0; i < N; i++) counts[roll(`1d${sides}`).total]++
    expect(counts[0]).toBe(0)
    expect(chiSquare(counts, () => 1 / sides)).toBeLessThan(limit(sides - 1))
  })

  it.each([
    ['advantage', (v: number) => (2 * v - 1) / 400],
    ['disadvantage', (v: number) => (41 - 2 * v) / 400],
  ] as const)('d20 with %s matches the exact distribution', (mode, p) => {
    const counts = new Array<number>(21).fill(0)
    for (let i = 0; i < N; i++) counts[rollD20(0, { mode }).d20!.natural]++
    expect(counts[0]).toBe(0)
    expect(chiSquare(counts, p)).toBeLessThan(limit(19))
  })
})

describe('rng', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects values at or above the limit and redraws', () => {
    const lim = Math.floor(2 ** 32 / 6) * 6
    const values = [lim, 13]
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((buf: ArrayBufferView<ArrayBuffer>) => {
      ;(buf as Uint32Array<ArrayBuffer>)[0] = values.shift()!
      return buf
    })
    expect(randomInt(6)).toBe(13 % 6)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('randomInt(1) is always 0', () => {
    for (let i = 0; i < 100; i++) expect(randomInt(1)).toBe(0)
  })

  it('rejects a bad n', () => {
    expect(() => randomInt(0)).toThrow(RangeError)
    expect(() => randomInt(2.5)).toThrow(RangeError)
    expect(() => randomInt(2 ** 32 + 1)).toThrow(RangeError)
  })

  it('randomFloat stays in [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const x = randomFloat()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('throws instead of falling back when crypto is missing', () => {
    vi.stubGlobal('crypto', undefined)
    expect(() => randomInt(20)).toThrow(/getRandomValues/)
    expect(() => randomFloat()).toThrow(/getRandomValues/)
    expect(() => roll('1d20')).toThrow(/getRandomValues/)
    vi.unstubAllGlobals()
    expect(randomInt(20)).toBeGreaterThanOrEqual(0)
  })
})

describe('d20Stats', () => {
  const seq = (values: number[]) => {
    let i = 0
    return () => values[i++]
  }

  it('is empty with no rolls', () => {
    expect(d20Stats([])).toEqual({ n: 0, average: 0, nat1: 0, nat20: 0, expected: 0, z: 0, verdict: 'none' })
  })

  it('counts both dice of advantage and ignores other dice', () => {
    const rolls: RollResult[] = [
      rollD20(3, { mode: 'advantage', rng: seq([1, 20]) }),
      rollD20(0, { mode: 'disadvantage', rng: seq([5, 20]) }),
      roll('2d6+1d20', { rng: seq([6, 6, 10]) }),
    ]
    const s = d20Stats(rolls)
    expect(s.n).toBe(5)
    expect(s.average).toBeCloseTo(56 / 5)
    expect(s.nat1).toBe(1)
    expect(s.nat20).toBe(2)
    expect(s.expected).toBeCloseTo(0.25)
    expect(s.verdict).toBe('none')
  })

  it('counts a Lucky reroll and the struck-through 1', () => {
    const r = rollD20(0, { lucky: true, rng: seq([1, 15]) })
    expect(d20Stats([r])).toMatchObject({ n: 2, nat1: 1, average: 8 })
  })

  const fixed = (value: number, count: number) => Array.from({ length: count }, () => roll('1d20', { rng: () => value }))

  it('calls a fair-looking history normal', () => {
    const rolls = Array.from({ length: 40 }, (_, i) => roll('1d20', { rng: () => (i % 20) + 1 }))
    const s = d20Stats(rolls)
    expect(s.average).toBe(10.5)
    expect(s.z).toBe(0)
    expect(s.verdict).toBe('normal')
    expect(s.nat1).toBe(2)
    expect(s.expected).toBe(2)
  })

  it('flags cold and hot streaks', () => {
    expect(d20Stats(fixed(3, 30)).verdict).toBe('low')
    expect(d20Stats(fixed(18, 30)).verdict).toBe('high')
    expect(d20Stats(fixed(3, 19)).verdict).toBe('none')
  })

  it('z follows (average - 10.5) / (sqrt(33.25) / sqrt(n))', () => {
    const s = d20Stats(fixed(12, 25))
    expect(s.z).toBeCloseTo(1.5 / (Math.sqrt(33.25) / 5))
    expect(s.verdict).toBe('normal')
  })
})
