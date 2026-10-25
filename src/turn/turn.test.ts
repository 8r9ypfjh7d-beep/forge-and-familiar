import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { dash, FRESH_TURN, limits, move, movementTotal, nextTurn, toggle, bonusOptions, takeReaction } from './turn'

describe('turn checklist', () => {
  it('ticks and unticks an action', () => {
    const t = toggle(FRESH_TURN, 'action')
    expect(t.used.action).toBe(true)
    expect(toggle(t, 'action').used.action).toBe(false)
  })

  it('next turn resets everything, reaction included, and counts the round', () => {
    let t = toggle(toggle(toggle(FRESH_TURN, 'action'), 'bonus'), 'reaction')
    t = dash(move(t, 30, 30))
    const n = nextTurn(t)
    expect(n.used).toEqual({ action: false, bonus: false, reaction: false })
    expect(n.moved).toBe(0)
    expect(n.dashes).toBe(0)
    expect(n.round).toBe(2)
  })

  it('keeps movement between 0 and speed, and Dash adds speed again', () => {
    expect(move(FRESH_TURN, -5, 30).moved).toBe(0)
    expect(move(FRESH_TURN, 45, 30).moved).toBe(30)
    const dashed = dash(move(FRESH_TURN, 30, 30))
    expect(movementTotal(dashed, 30)).toBe(60)
    expect(move(dashed, 15, 30).moved).toBe(45)
  })

  it('returns the same state when a move changes nothing', () => {
    expect(move(FRESH_TURN, -5, 30)).toBe(FRESH_TURN)
  })

  it('blocks movement when grappled and everything when stunned or at 0 HP', () => {
    const grappled = makeCharacter()
    grappled.state.conditions = ['grappled']
    expect(limits(grappled)).toEqual({ noActions: undefined, noMovement: 'grappled' })

    const stunned = makeCharacter()
    stunned.state.conditions = ['stunned']
    expect(limits(stunned)).toEqual({ noActions: 'stunned', noMovement: 'stunned' })

    const down = makeCharacter()
    down.state.currentHp = 0
    expect(limits(down).noActions).toBe('unconscious')
  })

  it('lists class bonus actions by level', () => {
    expect(bonusOptions(makeCharacter())).toContain('Second Wind')
    expect(bonusOptions(makeCharacter({ classes: [{ classId: 'rogue', level: 1 }] }))).toEqual([])
    expect(bonusOptions(makeCharacter({ classes: [{ classId: 'rogue', level: 2 }] }))).toEqual(['Cunning Action'])
  })

  it('records a named reaction and gives it back', () => {
    const t = takeReaction(FRESH_TURN, 'Shield')
    expect(t.used.reaction).toBe(true)
    expect(t.reactionName).toBe('Shield')
    const back = takeReaction(t, null)
    expect(back.used.reaction).toBe(false)
    expect(back.reactionName).toBeUndefined()
    expect(toggle(t, 'reaction').reactionName).toBeUndefined()
    expect(nextTurn(t).reactionName).toBeUndefined()
  })
})
