import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { KEYPAD_MAX, pressKey, tracks } from './tracks'

describe('pressKey', () => {
  it('builds a number, ignores leading zeros, and caps it', () => {
    expect(['1', '2'].reduce(pressKey, '')).toBe('12')
    expect(pressKey('', '0')).toBe('')
    expect(pressKey(String(KEYPAD_MAX), '1')).toBe(String(KEYPAD_MAX))
  })
  it('backspaces and clears', () => {
    expect(pressKey('12', 'back')).toBe('1')
    expect(pressKey('12', 'clear')).toBe('')
  })
})

describe('tracks', () => {
  it('lists spell slots and class resources with what is left', () => {
    const c = makeCharacter()
    const ids = tracks(c).map(t => t.id)
    expect(ids).toContain('slot-1')
    expect(ids).toContain('action-surge')
    const slot = tracks(c).find(t => t.id === 'slot-1')!
    expect(slot.remaining).toBe(slot.max)
  })
  it('spends one and gives it back, clamped to the pool', () => {
    let c = makeCharacter()
    const slot = () => tracks(c).find(t => t.id === 'slot-1')!
    const max = slot().max
    for (let i = 0; i < max + 2; i++) c = slot().change(c, 1)
    expect(slot().remaining).toBe(0)
    c = slot().change(c, -1)
    expect(slot().remaining).toBe(1)
  })
  it('includes custom trackers', () => {
    const c = makeCharacter({})
    const withArrows = { ...c, state: { ...c.state, counters: [{ id: 'arrows', label: 'Arrows', max: 20, used: 3, recharge: 'none' as const }] } }
    const t = tracks(withArrows).find(x => x.id === 'arrows')!
    expect(t.remaining).toBe(17)
    expect(tracks(t.change(withArrows, 1)).find(x => x.id === 'arrows')!.remaining).toBe(16)
  })
})
