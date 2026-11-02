import { describe, expect, it } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { addHit, createEncounter, HIT_LIMIT } from './engine'
import { answerConcentrationCheck, owedConcentrationChecks, takeHits } from './hits'
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

describe('concentration saves for the DM\'s hits', () => {
  const concentrating = () => {
    const c = makeCharacter()
    return { ...c, state: { ...c.state, effects: [{ id: 'spell:bless', name: 'Bless', from: 'spell' as const, on: true, concentration: true, duration: '1 minute', ends: 'short' as const }] } }
  }

  it('queues one save per hit while concentrating, DC 10 or half the damage', () => {
    const c = takeHits(concentrating(), [hit('a', 4), hit('b', 24)])
    expect(owedConcentrationChecks(c).map(x => [x.id, x.dc, x.name])).toEqual([['a', 10, 'Bless'], ['b', 12, 'Bless']])
  })

  it('owes nothing when not concentrating or knocked out', () => {
    expect(takeHits(makeCharacter(), [hit('a', 4)]).state.concentrationChecks).toBeUndefined()
    const c = concentrating()
    expect(owedConcentrationChecks(takeHits(c, [hit('a', c.state.currentHp + 1)]))).toEqual([])
  })

  it('a kept save drops that check; a failed one ends the spell and every check for it', () => {
    const c = takeHits(concentrating(), [hit('a', 4), hit('b', 6)])
    const kept = answerConcentrationCheck(c, 'a', true)
    expect(owedConcentrationChecks(kept).map(x => x.id)).toEqual(['b'])
    expect(kept.state.effects).toHaveLength(1)
    const lost = answerConcentrationCheck(c, 'a', false)
    expect(lost.state.effects).toEqual([])
    expect(lost.state.concentrationChecks).toBeUndefined()
  })
})
