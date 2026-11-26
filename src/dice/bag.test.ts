import { afterEach, describe, expect, it } from 'vitest'
import { DiceBag, shuffledBag, type BagState, type BagStorage } from './bag'
import { roll, rollD20, setDefaultRng } from './roll'

function memoryStorage(initial?: unknown): BagStorage & { state: unknown } {
  const s = {
    state: initial,
    load: () => s.state as BagState | undefined,
    save: (state: BagState) => { s.state = JSON.parse(JSON.stringify(state)) },
  }
  return s
}

const faces = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

afterEach(() => setDefaultRng(null))

describe('streak-free dice bag', () => {
  it('every aligned block of 20 d20 draws shows each face exactly once', () => {
    for (let b = 0; b < 200; b++) {
      const bag = new DiceBag()
      for (let block = 0; block < 5; block++) {
        const drawn = Array.from({ length: 20 }, () => bag.draw(20))
        expect([...drawn].sort((x, y) => x - y)).toEqual(faces(20))
      }
    }
  })

  it('50 full bags sum to exactly 50 × 210', () => {
    const bag = new DiceBag()
    let sum = 0
    for (let i = 0; i < 50 * 20; i++) sum += bag.draw(20)
    expect(sum).toBe(50 * 210)
  })

  it('shuffles uniformly: face 1 lands in every position equally (chi-square, 40,000 bags)', () => {
    const N = 40_000
    const counts = new Array(20).fill(0)
    for (let i = 0; i < N; i++) counts[shuffledBag(20).indexOf(1)]++
    const expected = N / 20
    const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0)
    expect(chi).toBeLessThan(19 * (1 - 2 / 171 + 4.75 * Math.sqrt(2 / 171)) ** 3)
  })

  it('persists: a new bag on the same storage continues the same bag', () => {
    const storage = memoryStorage()
    const first = new DiceBag(storage)
    const drawn = Array.from({ length: 7 }, () => first.draw(20))
    const rest = [...(storage.state as BagState)[20]]
    const second = new DiceBag(storage)
    const next = Array.from({ length: 13 }, () => second.draw(20))
    expect(next).toEqual(rest)
    expect([...drawn, ...next].sort((x, y) => x - y)).toEqual(faces(20))
  })

  it.each([
    ['not an object', 'junk'],
    ['out of range', { 20: [0, 21, 5] }],
    ['duplicates', { 20: [3, 3, 4] }],
    ['not integers', { 20: [1.5, 2] }],
    ['too many faces', { 6: [1, 2, 3, 4, 5, 6, 1] }],
  ])('discards corrupt storage (%s)', (_, bad) => {
    const storage = memoryStorage(bad)
    const bag = new DiceBag(storage)
    const drawn = Array.from({ length: 20 }, () => bag.draw(20))
    expect([...drawn].sort((x, y) => x - y)).toEqual(faces(20))
  })

  it('falls back to plain random for dice outside 2..100 sides', () => {
    const storage = memoryStorage()
    const bag = new DiceBag(storage)
    for (let i = 0; i < 200; i++) {
      const v = bag.draw(1000)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(1000)
    }
    expect(bag.draw(1)).toBe(1)
    expect(storage.state).toBeUndefined()
  })

  it('advantage under the bag draws two different faces', () => {
    const bag = new DiceBag()
    setDefaultRng(bag.draw, true)
    for (let i = 0; i < 100; i++) {
      const r = rollD20(0, { mode: 'advantage' })
      const d = r.terms[0]
      if (d.kind !== 'dice') throw new Error('expected dice')
      expect(d.rolls[0].value).not.toBe(d.rolls[1].value)
    }
  })
})

describe('streakFree flag on rolls', () => {
  it('is set only when the default source is flagged streak-free', () => {
    const bag = new DiceBag()
    setDefaultRng(bag.draw, true)
    expect(rollD20(3).streakFree).toBe(true)
    expect(roll('2d6+1').streakFree).toBe(true)
    setDefaultRng(bag.draw)
    expect('streakFree' in rollD20(3)).toBe(false)
  })

  it('is absent when off', () => {
    expect('streakFree' in rollD20(3)).toBe(false)
    expect('streakFree' in roll('d20')).toBe(false)
  })

  it('is absent when the caller passes its own rng', () => {
    setDefaultRng(new DiceBag().draw, true)
    const r = rollD20(0, { rng: () => 7 })
    expect('streakFree' in r).toBe(false)
    expect(r.total).toBe(7)
  })
})
