import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RollResult } from '../dice'

// A tiny stand-in for the parties tables and RPCs, with the server's rules for one caller.
const server = vi.hoisted(() => ({
  me: 'acct-roy' as string | null,
  parties: new Map<string, { id: string; name: string; code: string; dm_id: string; stash: unknown; rev: number; created_at: string; updated_at: string }>(),
  members: [] as { party_id: string; user_id: string; character_id: string | null; joined_at: string }[],
  /** Simulates another member writing the stash between our read and write. */
  raceOnce: false,
}))

vi.mock('../cloud', () => {
  const rowsFor = () => [...server.parties.values()]
    .filter(p => server.members.some(m => m.party_id === p.id && m.user_id === server.me))
    .map(p => ({ ...p, party_members: server.members.filter(m => m.party_id === p.id) }))
  const db = {
    rpc: async (name: string, args: Record<string, string | null>) => {
      const now = new Date().toISOString()
      if (name === 'create_party') {
        server.parties.set(args.p_id!, { id: args.p_id!, name: args.p_name!, code: args.p_code!, dm_id: args.p_dm ?? server.me!, stash: null, rev: 1, created_at: now, updated_at: now })
        server.members.push({ party_id: args.p_id!, user_id: server.me!, character_id: null, joined_at: now })
        if (args.p_dm && args.p_dm !== server.me) server.members.push({ party_id: args.p_id!, user_id: args.p_dm, character_id: null, joined_at: now })
        return { data: null, error: null }
      }
      if (name === 'join_party') {
        const p = [...server.parties.values()].find(x => x.code === args.p_code)
        if (!p) return { data: null, error: null }
        server.members.push({ party_id: p.id, user_id: server.me!, character_id: args.p_character, joined_at: now })
        return { data: p.id, error: null }
      }
      return { data: null, error: null }
    },
    from: () => {
      const filters: [string, unknown][] = []
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q },
        returns: async () => ({ data: rowsFor(), error: null }),
        maybeSingle: async () => ({ data: rowsFor().find(p => p.id === filters.find(f => f[0] === 'id')?.[1]) ?? null, error: null }),
        update: (patch: { stash: unknown; rev: number }) => ({
          eq: (_: string, id: string) => ({
            eq: (__: string, rev: number) => ({
              select: async () => {
                const p = server.parties.get(id)!
                if (server.raceOnce) { server.raceOnce = false; p.rev++ }
                if (p.rev !== rev) return { data: [], error: null }
                Object.assign(p, patch)
                return { data: [{ id }], error: null }
              },
            }),
          }),
        }),
      }
      return q
    },
  }
  return { getCloudAccountId: () => server.me, getSupabase: async () => db, isCloudEnabled: () => true }
})

import { createParty, joinParty, listParties, updateStash } from './store'
import { mergeRollLists } from './feed'

describe('cloud parties', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    })
    vi.stubGlobal('window', new EventTarget())
    server.me = 'acct-roy'
    server.parties.clear()
    server.members.length = 0
  })

  it('creates on the server and another account joins by code', async () => {
    const party = await createParty('Heroes', 'acct-roy')
    expect(server.parties.has(party.id)).toBe(true)
    expect(party.dmId).toBe('acct-roy')
    expect(localStorage.getItem('ff.parties.v1')).toBeNull()

    server.me = 'acct-tamir'
    const res = await joinParty(party.code.toLowerCase(), 'acct-tamir', 'c-ash')
    expect(res.ok && res.party.members.map(m => [m.userId, m.characterId])).toEqual([['acct-roy', undefined], ['acct-tamir', 'c-ash']])
    expect((await joinParty('ZZZZZZ', 'acct-tamir')).ok).toBe(false)
  })

  it('opens a campaign you are already in, and says when this device is signed in as someone else', async () => {
    server.me = 'acct-noa'
    const party = await createParty('Grove', 'acct-noa')
    const again = await joinParty(party.code, 'acct-noa')
    expect(again.ok && again.party.id).toBe(party.id)
    expect(await joinParty(party.code, 'acct-maayan')).toEqual({ ok: false, reason: 'notLinked' })
  })

  it('names another player as DM; both join', async () => {
    server.me = 'acct-ziv'
    const party = await createParty('Garden', 'acct-ziv', 'acct-noa')
    expect(server.parties.has(party.id)).toBe(true)
    expect(party.dmId).toBe('acct-noa')
    expect(party.members.map(m => m.userId).sort()).toEqual(['acct-noa', 'acct-ziv'])
  })

  it('a local profile on a signed-in device keeps parties on the device', async () => {
    const party = await createParty('Kids table', 'local-1')
    expect(server.parties.size).toBe(0)
    expect(await listParties('local-1')).toEqual([party])
    const other = await createParty('Second table', 'local-1', 'local-2')
    expect(other.dmId).toBe('local-2')
    expect(other.members.map(m => m.userId)).toEqual(['local-1', 'local-2'])
  })

  it('stash changes read again when someone else wrote first', async () => {
    const party = await createParty('Heroes', 'acct-roy')
    server.raceOnce = true
    const res = await updateStash(party.id, 'acct-roy', { type: 'coins', delta: { gp: 5 } })
    expect(res.ok).toBe(true)
    expect(server.parties.get(party.id)!.rev).toBe(3)
  })
})

describe('mergeRollLists', () => {
  const roll = (id: string, timestamp: string) => ({ id, timestamp }) as RollResult
  it('keeps each roll once, newest first', () => {
    expect(mergeRollLists([roll('a', '1'), roll('b', '3')], [roll('b', '3'), roll('c', '2')]).map(r => r.id)).toEqual(['b', 'c', 'a'])
  })
})
