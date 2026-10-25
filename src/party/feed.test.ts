import { describe, expect, it } from 'vitest'
import type { RollResult } from '../dice'
import { mergePartyRolls } from './feed'
import type { Party } from './types'

const party: Party = {
  id: 'p1', name: 'The Lost Mine', code: 'ABC234', dmId: 'dm',
  members: [
    { userId: 'dm', joinedAt: '2026-01-01T00:00:00Z' },
    { userId: 'ana', characterId: 'c-ana', joinedAt: '2026-01-02T00:00:00Z' },
    { userId: 'bo', characterId: 'c-bo', joinedAt: '2026-01-01T00:00:00Z' },
  ],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

const roll = (id: string, characterId: string | undefined, timestamp: string, extra: object = {}): RollResult => ({
  id, notation: 'd20', type: 'custom', total: 10, terms: [], breakdown: '10', timestamp,
  roller: characterId ? { characterId, characterName: characterId } : undefined, ...extra,
})

describe('party roll feed', () => {
  it('merges members newest first and tags who rolled', () => {
    const feed = mergePartyRolls(party, {
      ana: [roll('a2', 'c-ana', '2026-01-03T00:00:03Z'), roll('a1', 'c-ana', '2026-01-03T00:00:01Z')],
      bo: [roll('b1', 'c-bo', '2026-01-03T00:00:02Z')],
    })
    expect(feed.map(e => [e.roll.id, e.userId])).toEqual([['a2', 'ana'], ['b1', 'bo'], ['a1', 'ana']])
  })

  it("keeps only the party character's rolls, made after joining", () => {
    const feed = mergePartyRolls(party, {
      ana: [roll('other-char', 'c-other', '2026-01-03T00:00:00Z'), roll('untagged', undefined, '2026-01-03T00:00:00Z'), roll('before', 'c-ana', '2026-01-01T12:00:00Z')],
    })
    expect(feed).toEqual([])
  })

  it('leaves out watchers and secret rolls', () => {
    const feed = mergePartyRolls(party, {
      dm: [roll('dm', 'c-dm', '2026-01-03T00:00:00Z')],
      bo: [roll('secret', 'c-bo', '2026-01-03T00:00:00Z', { secret: { partyId: 'p1', dmId: 'dm', fromUserId: 'bo' } })],
    })
    expect(feed).toEqual([])
  })

  it('caps the feed', () => {
    const many = Array.from({ length: 80 }, (_, i) => roll(`r${i}`, 'c-bo', `2026-01-03T00:00:${String(i % 60).padStart(2, '0')}Z`))
    expect(mergePartyRolls(party, { bo: many }, 20)).toHaveLength(20)
  })
})
