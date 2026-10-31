import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { addHit, createEncounter, HIT_LIMIT } from './engine'
import { takeHits } from './hits'
import { playerView } from './playerView'
import type { Hit } from './types'

const hit = (id: string, amount: number, kind: Hit['kind'] = 'damage', characterId = 'demo'): Hit =>
  ({ id, characterId, kind, amount, at: '2026-10-31T00:00:00Z' })

describe('live-combat hits for characters on players\' phones', () => {
  it('queues hits on the encounter and shows them to players', () => {
    let e = createEncounter('e1', 'dm', 'Ambush', '2026-10-31T00:00:00Z')
    e = addHit(e, hit('h1', 7))
    e = addHit(e, hit('h0', 0))
    expect(e.hits?.map(h => h.id)).toEqual(['h1'])
    expect(playerView(e).hits).toEqual([hit('h1', 7)])
    expect(playerView(createEncounter('e2', 'dm', 'x')).hits).toBeUndefined()
  })

  it('keeps only the newest hits', () => {
    let e = createEncounter('e1', 'dm', 'Ambush')
    for (let i = 0; i < HIT_LIMIT + 5; i++) e = addHit(e, hit(`h${i}`, 1))
    expect(e.hits).toHaveLength(HIT_LIMIT)
    expect(e.hits?.[0].id).toBe('h5')
  })

  it('applies each hit to its own character once', () => {
    const c = makeCharacter()
    const max = c.state.currentHp
    const hits = [hit('a', 10), hit('b', 3, 'heal'), hit('c', 5, 'damage', 'someone-else')]
    const once = takeHits(c, hits)
    expect(once.state.currentHp).toBe(max - 7)
    expect(once.appliedHits).toEqual(['a', 'b'])
    expect(takeHits(once, hits)).toBe(once)
    expect(takeHits(c, undefined)).toBe(c)
  })
})
