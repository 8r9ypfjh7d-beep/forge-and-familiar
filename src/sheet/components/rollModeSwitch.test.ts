import { describe, expect, it } from 'vitest'
import { rollModeCauses } from '../../rules'
import { effectiveMode } from './RollModeSwitch'

const state = (conditions: string[], effects: unknown[] = []) => ({ state: { conditions, effects } }) as never

describe('roll mode causes', () => {
  it('names the conditions behind a forced disadvantage', () => {
    const c = rollModeCauses(state(['poisoned', 'prone']), 'attack')
    expect(c.mode).toBe('disadvantage')
    expect(c.dis).toEqual([{ condition: 'poisoned' }, { condition: 'prone' }])
  })
  it('names a running effect that gives advantage, and cancels against a condition', () => {
    const foresight = { name: 'Foresight', on: true, stats: [{ kind: 'advantage', on: 'attacks' }] }
    expect(rollModeCauses(state([], [foresight]), 'attack')).toMatchObject({ mode: 'advantage', adv: [{ effect: 'Foresight' }] })
    expect(rollModeCauses(state(['poisoned'], [foresight]), 'attack').mode).toBe('normal')
  })
})

describe('effectiveMode', () => {
  it('shows what the next roll really uses', () => {
    expect(effectiveMode('normal', 'disadvantage')).toBe('disadvantage')
    expect(effectiveMode('advantage', 'disadvantage')).toBe('normal')
    expect(effectiveMode('advantage', 'normal')).toBe('advantage')
    expect(effectiveMode('disadvantage', 'disadvantage')).toBe('disadvantage')
  })
})
