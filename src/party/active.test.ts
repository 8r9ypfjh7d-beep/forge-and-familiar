import { describe, expect, it } from 'vitest'
import { activeParty, campaignTarget, isPartyDm, NO_PARTY } from './active'
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

  it('makes the party\'s DM the DM, per party', () => {
    expect(isPartyDm(garden, 'acct-noa')).toBe(true)
    expect(isPartyDm(side, 'acct-noa')).toBe(false)
    expect(isPartyDm(undefined, 'acct-noa')).toBe(false)
  })
})

describe('campaign home', () => {
  const table: Party = {
    ...garden,
    members: [
      { userId: 'acct-noa', joinedAt: '2026-01-01T00:00:00Z' },
      { userId: 'acct-roy', characterId: 'grog', joinedAt: '2026-01-01T00:00:00Z' },
      { userId: 'acct-tamir', joinedAt: '2026-01-01T00:00:00Z' },
    ],
  }
  it('sends the DM to the DM screen', () => {
    expect(campaignTarget(table, 'acct-noa', [])).toEqual({ kind: 'dm' })
  })
  it('opens the sheet a player brings, when it is on this device', () => {
    expect(campaignTarget(table, 'acct-roy', ['grog'])).toEqual({ kind: 'sheet', id: 'grog' })
  })
  it('opens the party page when the player brings nothing or the sheet is elsewhere', () => {
    expect(campaignTarget(table, 'acct-tamir', ['other'])).toEqual({ kind: 'party', partyId: 'garden' })
    expect(campaignTarget(table, 'acct-roy', [])).toEqual({ kind: 'party', partyId: 'garden' })
  })
})
