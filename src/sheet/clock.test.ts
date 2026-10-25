import { describe, expect, it } from 'vitest'
import { dawnsBetween, DEFAULT_START, formatClock, formatDuration, minutesToNextDawn, parseDuration } from './clock'
import { advanceTime, clockOf, longRest, setClock, upsertCounter } from './engine'
import { makeCharacter } from './fixtures'

const H = 60
const DAY = 24 * H

describe('clock', () => {
  it('starts on day 1 at 08:00 and formats days and times', () => {
    expect(clockOf(makeCharacter())).toBe(DEFAULT_START)
    expect(formatClock(DEFAULT_START)).toBe('Day 1, 08:00')
    expect(formatClock(2 * DAY + 14 * H + 5)).toBe('Day 3, 14:05')
    expect(formatDuration(DAY + 2 * H + 5)).toBe('1 d 2 h 5 min')
  })

  it('counts dawns crossed, arriving exactly at 06:00 included', () => {
    expect(dawnsBetween(8 * H, 20 * H)).toBe(0)
    expect(dawnsBetween(22 * H, DAY + 6 * H)).toBe(1)
    expect(dawnsBetween(DAY + 6 * H, DAY + 7 * H)).toBe(0)
    expect(dawnsBetween(0, 3 * DAY)).toBe(3)
  })

  it('knows the time to the next dawn', () => {
    expect(minutesToNextDawn(22 * H)).toBe(8 * H)
    expect(minutesToNextDawn(6 * H)).toBe(DAY)
  })

  it('reads typed durations', () => {
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration('1h 30m')).toBe(90)
    expect(parseDuration('2 hours')).toBe(120)
    expect(parseDuration('1d')).toBe(DAY)
    expect(parseDuration('soon')).toBeNull()
    expect(parseDuration('0')).toBeNull()
  })
})

describe('dawn recharges', () => {
  const wand = { id: 'wand', label: 'Wand of Magic Missiles', max: 7, used: 6, recharge: 'dawn' as const, regain: '1d6+1' }
  const cape = { id: 'cape', label: 'Cape of the Mountebank', max: 1, used: 1, recharge: 'dawn' as const }
  const evening = setClock(upsertCounter(upsertCounter(makeCharacter(), wand), cape), 22 * H)
  const counter = (c: ReturnType<typeof makeCharacter>, id: string) => c.state.counters!.find(k => k.id === id)!

  it('runs dawn once per 06:00 passed, with that dawn\'s rolls', () => {
    const morning = advanceTime(evening, 8 * H, [{ wand: 4 }])
    expect(clockOf(morning)).toBe(DAY + 6 * H)
    expect(counter(morning, 'wand').used).toBe(2)
    expect(counter(morning, 'cape').used).toBe(0)

    const threeDays = advanceTime(evening, 3 * DAY, [{ wand: 2 }, { wand: 2 }, { wand: 5 }])
    expect(counter(threeDays, 'wand').used).toBe(0)
  })

  it('no dawn, no charges', () => {
    const lateNight = advanceTime(evening, H, [{ wand: 4 }])
    expect(clockOf(lateNight)).toBe(23 * H)
    expect(counter(lateNight, 'wand').used).toBe(6)
    expect(counter(lateNight, 'cape').used).toBe(1)
  })

  it('a long rest does not refill dawn items by itself', () => {
    expect(counter(longRest(evening), 'wand').used).toBe(6)
  })

  it('setting the clock is not passing time', () => {
    expect(counter(setClock(evening, 3 * DAY), 'wand').used).toBe(6)
  })
})
