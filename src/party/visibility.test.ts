import { describe, expect, it } from 'vitest'
import type { Party } from './types'
import { broughtToSharedParty, canViewCharacter, isDmOf } from './visibility'

const party = (over: Partial<Party> = {}): Party => ({
  id: 'p1', name: 'Garden Gang', code: 'GARDEN', dmId: 'acct-noa',
  members: [
    { userId: 'acct-noa', joinedAt: '2026-10-28T00:00:00Z' },
    { userId: 'acct-roy', characterId: 'c-roy', joinedAt: '2026-10-28T00:00:00Z' },
    { userId: 'acct-tamir', characterId: 'c-tamir', joinedAt: '2026-10-28T00:00:00Z' },
  ],
  createdAt: '2026-10-28T00:00:00Z', updatedAt: '2026-10-28T00:00:00Z', ...over,
})
const roysHero = { id: 'c-roy', ownerId: 'acct-roy' }
const roysOther = { id: 'c-roy-2', ownerId: 'acct-roy' }

describe('canViewCharacter', () => {
  it('lets the owner see their own, brought or not', () => {
    const roy = { userId: 'acct-roy', parties: [] }
    expect(canViewCharacter(roysHero, roy) && canViewCharacter(roysOther, roy)).toBe(true)
  })

  it('lets party members and the DM see the character a member brings, nothing else of theirs', () => {
    const tamir = { userId: 'acct-tamir', parties: [party()] }
    const noa = { userId: 'acct-noa', parties: [party()] }
    expect(canViewCharacter(roysHero, tamir) && canViewCharacter(roysHero, noa)).toBe(true)
    expect(canViewCharacter(roysOther, tamir) || canViewCharacter(roysOther, noa)).toBe(false)
    expect(broughtToSharedParty(roysHero, tamir)).toBe(true)
  })

  it('keeps outsiders and other devices\' profiles out', () => {
    const outsider = { userId: 'acct-maayan', parties: [party()] }
    const noParties = { userId: 'acct-tamir', parties: [] }
    expect(canViewCharacter(roysHero, outsider)).toBe(false)
    expect(canViewCharacter(roysHero, noParties)).toBe(false)
  })

  it('lets the admin see everything', () => {
    expect(canViewCharacter(roysOther, { userId: 'acct-ziv', parties: [] })).toBe(true)
  })

  it('knows the DM of a character\'s table', () => {
    expect(isDmOf(roysHero, { userId: 'acct-noa', parties: [party()] })).toBe(true)
    expect(isDmOf(roysHero, { userId: 'acct-tamir', parties: [party()] })).toBe(false)
    expect(isDmOf(roysOther, { userId: 'acct-noa', parties: [party()] })).toBe(false)
  })
})
