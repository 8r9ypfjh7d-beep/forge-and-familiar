import { describe, expect, it } from 'vitest'
import { activeParty, isPartyDm, needsPartyPick, NO_PARTY } from './active'
import type { Party } from './types'

const party = (id: string, dmId: string): Party => ({
  id, name: id, code: 'ABC234', dmId, members: [{ userId: dmId, joinedAt: '2026-01-01T00:00:00Z' }],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
})
const garden = party('garden', 'acct-noa')
const side = party('side', 'acct-roy')

describe('party in play', () => {
  it('uses the remembered party, or the only one', () => {
    expect(activeParty([garden, side], 'side')).toBe(side)
    expect(activeParty([garden], null)).toBe(garden)
    expect(activeParty([garden, side], null)).toBeUndefined()
    expect(activeParty([garden], 'left-long-ago')).toBe(garden)
    expect(activeParty([garden], NO_PARTY)).toBeUndefined()
  })

  it('asks on entering the app when there is more than one party', () => {
    expect(needsPartyPick([garden, side], false)).toBe(true)
    expect(needsPartyPick([garden, side], true)).toBe(false)
    expect(needsPartyPick([garden], false)).toBe(false)
    expect(needsPartyPick([], false)).toBe(false)
  })

  it('makes the party\'s DM the DM, per party', () => {
    expect(isPartyDm(garden, 'acct-noa')).toBe(true)
    expect(isPartyDm(side, 'acct-noa')).toBe(false)
    expect(isPartyDm(undefined, 'acct-noa')).toBe(false)
  })
})
