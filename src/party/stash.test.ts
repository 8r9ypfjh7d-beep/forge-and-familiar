import { describe, expect, it } from 'vitest'
import { applyStash, formatCoins, fromCp, getStash, splitCoins, STASH_LOG_LIMIT, toCp, type StashAction } from './stash'
import type { Party } from './types'

const party: Party = {
  id: 'p1', name: 'The Lost Mine', code: 'ABC234', dmId: 'dm',
  members: [{ userId: 'dm', joinedAt: '2026-01-01T00:00:00Z' }],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

/** Applies actions in order and fails the test on any refusal. */
function run(p: Party, ...actions: StashAction[]): Party {
  return actions.reduce((acc, a) => {
    const res = applyStash(acc, 'ana', a)
    if (!res.ok) throw new Error(res.reason)
    return res.party
  }, p)
}

describe('coins', () => {
  it('converts with SRD rates and formats without zeros', () => {
    expect(toCp({ pp: 1, gp: 2, ep: 1, sp: 3, cp: 4 })).toBe(1284)
    expect(fromCp(1284)).toEqual({ pp: 0, gp: 12, ep: 0, sp: 8, cp: 4 })
    expect(formatCoins({ gp: 12, sp: 0, cp: 4 })).toBe('12 gp 4 cp')
    expect(formatCoins({})).toBe('0 gp')
  })

  it('splits evenly and keeps the uneven copper', () => {
    const s = splitCoins({ pp: 0, gp: 10, ep: 0, sp: 0, cp: 1 }, 3)
    expect(s.share).toEqual({ pp: 0, gp: 3, ep: 0, sp: 3, cp: 3 })
    expect(s.leftoverCp).toBe(2)
  })

  it('adds and takes coins, refusing to go below zero', () => {
    const p = run(party, { type: 'coins', delta: { gp: 50 }, reason: 'goblin hoard' }, { type: 'coins', delta: { gp: -20 } })
    expect(getStash(p).coins.gp).toBe(30)
    expect(getStash(p).log.map(e => e.text)).toEqual(['took 20 gp', 'added 50 gp (goblin hoard)'])
    expect(applyStash(p, 'ana', { type: 'coins', delta: { gp: -31 } })).toEqual({ ok: false, reason: "The stash doesn't have those coins." })
  })

  it('split empties the purse down to the leftover copper', () => {
    const p = run(party, { type: 'coins', delta: { pp: 1, gp: 1 } }, { type: 'split', ways: 4 })
    expect(getStash(p).coins).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 })
    expect(getStash(p).log[0].text).toBe('split the coin 4 ways: 2 gp 7 sp 5 cp each')
    expect(applyStash(p, 'ana', { type: 'split', ways: 4 }).ok).toBe(false)
  })
})

describe('items', () => {
  it('works on parties saved before the stash existed', () => {
    expect(getStash(party)).toEqual({ items: [], coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, log: [] })
  })

  it('stacks the same item in the bag, but not ones with notes', () => {
    const p = run(party,
      { type: 'add', name: 'Potion of Healing', qty: 2, itemId: 'potion-healing' },
      { type: 'add', name: 'Potion of Healing', qty: 1, itemId: 'potion-healing' },
      { type: 'add', name: 'gem', qty: 1 },
      { type: 'add', name: 'Gem', qty: 2 },
      { type: 'add', name: 'Gem', qty: 1, note: 'glows faintly' },
    )
    expect(getStash(p).items.map(i => [i.name, i.qty])).toEqual([['Potion of Healing', 3], ['gem', 3], ['Gem', 1]])
  })

  it('uses items up and removes them at zero', () => {
    let p = run(party, { type: 'add', name: 'Torch', qty: 2 })
    const id = getStash(p).items[0].id
    p = run(p, { type: 'qty', id, delta: -1 })
    expect(getStash(p).log[0].text).toBe('used Torch')
    p = run(p, { type: 'qty', id, delta: -5 })
    expect(getStash(p).items).toEqual([])
  })

  it('tracks who carries an item', () => {
    let p = run(party, { type: 'add', name: 'Rope', qty: 1 })
    const id = getStash(p).items[0].id
    p = run(p, { type: 'hold', id, carry: true })
    expect(getStash(p).items[0].heldBy).toBe('ana')
    // Carried items don't absorb new loot of the same kind.
    p = run(p, { type: 'add', name: 'Rope', qty: 1 })
    expect(getStash(p).items).toHaveLength(2)
    p = run(p, { type: 'hold', id, carry: false })
    expect(getStash(p).items[0].heldBy).toBeUndefined()
    expect(getStash(p).log[0].text).toBe('put Rope back in the bag')
  })

  it('rejects empty names and bad quantities', () => {
    expect(applyStash(party, 'ana', { type: 'add', name: '  ', qty: 1 }).ok).toBe(false)
    expect(applyStash(party, 'ana', { type: 'add', name: 'Gem', qty: 0 }).ok).toBe(false)
    expect(applyStash(party, 'ana', { type: 'add', name: 'Gem', qty: NaN }).ok).toBe(false)
  })

  it('caps the log', () => {
    let p = party
    for (let i = 0; i < STASH_LOG_LIMIT + 5; i++) p = run(p, { type: 'coins', delta: { cp: 1 } })
    expect(getStash(p).log).toHaveLength(STASH_LOG_LIMIT)
  })
})
