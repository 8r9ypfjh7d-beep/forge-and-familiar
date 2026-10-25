import { describe, expect, it } from 'vitest'
import { addOption, bestOption, choose, isFinished, makePoll, relativeTime, reminderDue, removeOption, setVote, tally, toIcs } from './poll'

const T0 = new Date('2026-10-25T12:00:00Z')
const day = (n: number, h = 18) => new Date(Date.UTC(2026, 9, 25 + n, h))

function poll() {
  let p = makePoll('party', 'dm', T0, 'poll')
  p = addOption(p, day(3), 'dm', T0, 'a')
  p = addOption(p, day(5), 'ana', T0, 'b')
  return p
}

describe('session scheduler', () => {
  it('sorts dates, ignores duplicates and marks the proposer as free', () => {
    let p = addOption(poll(), day(1), 'ben', T0, 'c')
    p = addOption(p, day(3), 'ben', T0, 'dup')
    expect(p.options.map(o => o.id)).toEqual(['c', 'a', 'b'])
    expect(p.votes.ben).toEqual({ c: 'yes' })
  })

  it('records, changes and clears answers', () => {
    let p = setVote(poll(), 'ben', 'a', 'maybe', T0)
    p = setVote(p, 'ben', 'a', 'no', T0)
    expect(p.votes.ben.a).toBe('no')
    p = setVote(p, 'ben', 'a', undefined, T0)
    expect(p.votes.ben).toEqual({})
    expect(setVote(p, 'ben', 'missing', 'yes', T0)).toBe(p)
  })

  it('counts current members only and ranks by fewest no, then most yes', () => {
    let p = poll()
    p = setVote(p, 'ana', 'a', 'no', T0)
    p = setVote(p, 'ben', 'b', 'yes', T0)
    p = setVote(p, 'gone', 'a', 'yes', T0)
    const t = tally(p, ['dm', 'ana', 'ben'], T0)
    expect(t.map(x => [x.yes, x.maybe, x.no, x.pending])).toEqual([[1, 0, 1, 1], [2, 0, 0, 1]])
    expect(bestOption(t)?.option.id).toBe('b')
  })

  it('breaks ties by the soonest date and skips past dates', () => {
    const p = poll()
    expect(bestOption(tally(p, ['dm', 'ana'], T0))?.option.id).toBe('a')
    expect(bestOption(tally(p, ['dm', 'ana'], day(4)))?.option.id).toBe('b')
    expect(bestOption(tally(p, ['dm', 'ana'], day(6)))).toBeUndefined()
  })

  it('removing a date drops its votes and unlocks it', () => {
    let p = choose(poll(), 'a', T0)
    p = removeOption(p, 'a', T0)
    expect(p.options.map(o => o.id)).toEqual(['b'])
    expect(p.votes.dm).toEqual({})
    expect(p.chosenOptionId).toBeUndefined()
  })

  it('reminds from a day before until the session ends', () => {
    const p = choose(poll(), 'a', T0)
    expect(reminderDue(p, T0)).toBe(false)
    expect(reminderDue(p, day(2, 19))).toBe(true)
    expect(reminderDue(p, day(3, 21))).toBe(true)
    expect(isFinished(p, day(3, 21))).toBe(false)
    expect(reminderDue(p, day(3, 22))).toBe(false)
    expect(isFinished(p, day(3, 22))).toBe(true)
    expect(reminderDue(poll(), day(3))).toBe(false)
  })

  it('writes a calendar file with a day-before alarm', () => {
    expect(toIcs(poll(), 'Crew', T0)).toBeUndefined()
    const ics = toIcs(choose(poll(), 'a', T0), 'Dragons, Inc.', T0)!
    expect(ics).toContain('DTSTART:20261028T180000Z')
    expect(ics).toContain('DTEND:20261028T220000Z')
    expect(ics).toContain('SUMMARY:D&D: Dragons\\, Inc.')
    expect(ics).toContain('TRIGGER:-PT24H')
    expect(ics.split('\r\n').length).toBeGreaterThan(10)
  })

  it('formats coarse countdowns in the chosen language', () => {
    expect(relativeTime(day(0, 12), T0)).toBeUndefined()
    expect(relativeTime(new Date(T0.getTime() + 25 * 60_000), T0)).toBe('in 25 minutes')
    expect(relativeTime(day(0, 13), T0)).toBe('in 1 hour')
    expect(relativeTime(day(3), T0)).toBe('in 3 days')
    expect(relativeTime(day(3), T0, 'he')).toBe(new Intl.RelativeTimeFormat('he', { numeric: 'always' }).format(3, 'day'))
  })
})
