import { describe, expect, it } from 'vitest'
import { addSecret, maskSecret, roll, secretView, type SecretRoll } from './index'

const entry = (fromUserId: string, label: string): SecretRoll => ({ roll: roll('1d20+3', { label, rng: () => 15 }), fromUserId })

describe('secret rolls', () => {
  const list = [entry('p1', 'Stealth'), entry('p2', 'Insight'), entry('p1', 'Perception')]

  it('shows the DM every result', () => {
    const v = secretView(list, 'dm', 'dm')
    expect(v.kind).toBe('dm')
    expect(v.kind === 'dm' && v.rolls.map(s => s.roll.total)).toEqual([18, 18, 18])
  })

  it('shows a player only that their own rolls were sent, with no result', () => {
    const v = secretView(list, 'dm', 'p1')
    expect(v).toEqual({ kind: 'player', sent: [maskSecret(list[0]), maskSecret(list[2])] })
    expect(JSON.stringify(v)).not.toContain('"total"')
    expect(secretView(list, 'dm', 'p3')).toEqual({ kind: 'player', sent: [] })
  })

  it('keeps the newest first and caps the log', () => {
    let log: SecretRoll[] = []
    for (let i = 0; i < 5; i++) log = addSecret(log, entry('p1', `Roll ${i}`), 3)
    expect(log.map(s => s.roll.label)).toEqual(['Roll 4', 'Roll 3', 'Roll 2'])
  })
})
