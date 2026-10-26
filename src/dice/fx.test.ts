import { describe, expect, it } from 'vitest'
import { headlineDie, isNat20, NAT20_LINES, pickNat20Line, roll, rollD20, RollFxBus, type RollResult, type Rng } from './index'

const always = (v: number): Rng => () => v

describe('roll effects', () => {
  it('animates the kept d20 of a d20 roll', () => {
    const r = rollD20(5, { mode: 'advantage', rng: (() => { let i = 0; return () => [7, 20][i++ % 2] })() })
    expect(headlineDie(r)).toEqual({ sides: 20, value: 20 })
    expect(isNat20(r)).toBe(true)
  })

  it('treats a lone tray d20 as a natural 20, but not a 20 on 2d20 or a d100', () => {
    expect(isNat20(roll('d20+3', { rng: always(20) }))).toBe(true)
    expect(isNat20(roll('2d20', { rng: always(20) }))).toBe(false)
    expect(isNat20(roll('d100', { rng: always(20) }))).toBe(false)
    expect(isNat20(roll('d20', { rng: always(19) }))).toBe(false)
  })

  it('animates the first die of other rolls', () => {
    expect(headlineDie(roll('2d6+1', { rng: always(4) }))).toEqual({ sides: 6, value: 4 })
    expect(headlineDie(roll('5'))).toBeNull()
  })

  it('never repeats the last nat 20 line and covers every line', () => {
    const seen = new Set<number>()
    for (let i = 0; i < NAT20_LINES; i++) seen.add(pickNat20Line(() => i / NAT20_LINES))
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: NAT20_LINES }, (_, i) => i + 1))
    for (let last = 1; last <= NAT20_LINES; last++) {
      for (const x of [0, 0.5, 0.999]) {
        const n = pickNat20Line(() => x, last)
        expect(n).not.toBe(last)
        expect(n).toBeGreaterThanOrEqual(1)
        expect(n).toBeLessThanOrEqual(NAT20_LINES)
      }
    }
  })

  it('shows the to-hit, not the damage, when one tap records both', () => {
    let now = 0
    const bus = new RollFxBus(150, () => now)
    const seen: RollResult[] = []
    bus.subscribe(r => seen.push(r))
    const hit = rollD20(3, { rng: always(20) })
    const dmg = roll('2d8+3', { rng: always(8) })
    bus.push(hit)
    bus.push(dmg)
    expect(seen).toEqual([hit])
    now = 1000
    bus.push(dmg)
    expect(seen).toEqual([hit, dmg])
  })
})
