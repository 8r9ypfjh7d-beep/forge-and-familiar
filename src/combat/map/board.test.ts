import { describe, expect, it } from 'vitest'
import { budgetLeft, canMove, coverFog, revealFog, spend, tokenCovering } from './board'
import type { Token } from '../types'

const map = { width: 10, height: 10 }
const tok = (over: Partial<Token> = {}): Token => ({ id: 't1', combatantId: 'c1', kind: 'pc', label: 'VT', x: 2, y: 2, size: 2, characterId: 'ch1', ...over })

describe('board helpers', () => {
  it('covers and reveals rectangles of fog inside the grid', () => {
    const fog = coverFog([], { x: 8, y: 8 }, { x: 12, y: 9 }, map)
    expect(fog.sort()).toEqual(['8,8', '8,9', '9,8', '9,9'])
    expect(revealFog(fog, { x: 9, y: 8 }, { x: 9, y: 9 }).sort()).toEqual(['8,8', '8,9'])
  })

  it('finds the token covering a cell, ignoring unplaced tokens', () => {
    const tokens = [tok(), tok({ id: 't2', x: -1, y: -1 })]
    expect(tokenCovering(tokens, 3, 3)?.id).toBe('t1')
    expect(tokenCovering(tokens, 4, 3)).toBeUndefined()
    expect(tokenCovering(tokens, -1, -1)).toBeUndefined()
  })

  it('tracks the movement budget with dash', () => {
    expect(budgetLeft(30, 0, false)).toBe(30)
    expect(budgetLeft(30, 20, true)).toBe(40)
    expect(budgetLeft(30, 50, false)).toBe(0)
    expect(budgetLeft(undefined, 0, false)).toBeNull()
    expect(spend({ a: 5 }, 'a', 10)).toEqual({ a: 15 })
  })

  it('lets the DM move anything and a player only their character while unlocked', () => {
    expect(canMove(tok(), { role: 'dm' }, true)).toBe(true)
    expect(canMove(tok(), { role: 'player', characterId: 'ch1' }, false)).toBe(true)
    expect(canMove(tok(), { role: 'player', characterId: 'ch1' }, true)).toBe(false)
    expect(canMove(tok({ characterId: 'other' }), { role: 'player', characterId: 'ch1' }, false)).toBe(false)
    expect(canMove(tok({ kind: 'npc', characterId: undefined }), { role: 'player', characterId: 'ch1' }, false)).toBe(false)
  })
})

describe('mergeRemoteMoves', () => {
  it('takes moved positions only, and keeps the same board when nothing moved', async () => {
    const { mergeRemoteMoves } = await import('./board')
    const local = { tokens: [tok(), tok({ id: 't2', x: 5, y: 5, hidden: true })], fog: ['1,1' as const], locked: true }
    expect(mergeRemoteMoves(local, { tokens: [tok()], fog: [], locked: false })).toBe(local)
    const moved = mergeRemoteMoves(local, { tokens: [tok({ x: 7, y: 1, size: 1 })], fog: [], locked: false })
    expect(moved.tokens[0]).toMatchObject({ x: 7, y: 1, size: 2 })
    expect(moved.tokens[1]).toBe(local.tokens[1])
    expect(moved.fog).toEqual(['1,1'])
    expect(moved.locked).toBe(true)
  })
})
