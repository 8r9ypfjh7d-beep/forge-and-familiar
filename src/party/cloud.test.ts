import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RollResult } from '../dice'

// A tiny stand-in for the parties tables and RPCs, with the server's rules for one caller.
const server = vi.hoisted(() => ({
  me: 'acct-roy' as string | null,
  parties: new Map<string, { id: string; name: string; code: string; dm_id: string; stash: unknown; rev: number; created_at: string; updated_at: string; ended_at?: string | null }>(),
  members: [] as { party_id: string; user_id: string; character_id: string | null; joined_at: string }[],
  /** Simulates another member writing the stash between our read and write. */
  raceOnce: false,
  /** A server without the restore_party migration: no ended_at column, end_party deletes. */
  old: false,
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
      const dmOf = (id: string) => server.parties.get(id)?.dm_id === server.me
      if (name === 'end_party') {
        if (!dmOf(args.p_party!)) return { data: null, error: { code: 'P0001', message: 'only the DM can end this campaign' } }
        if (server.old) server.parties.delete(args.p_party!)
        else server.parties.get(args.p_party!)!.ended_at = now
        return { data: null, error: null }
      }
      if (name === 'restore_party') {
        if (!dmOf(args.p_party!)) return { data: null, error: { code: 'P0001', message: 'only the DM can bring this campaign back' } }
        server.parties.get(args.p_party!)!.ended_at = null
        return { data: null, error: null }
      }
      if (name === 'delete_party') {
        if (!dmOf(args.p_party!) || !server.parties.get(args.p_party!)!.ended_at) return { data: null, error: { code: 'P0001', message: 'only the DM can delete an ended campaign' } }
        server.parties.delete(args.p_party!)
        return { data: null, error: null }
      }
      if (name === 'join_party') {
        const p = [...server.parties.values()].find(x => x.code === args.p_code)
        if (!p) return { data: null, error: null }
        if (p.ended_at) return { data: null, error: { code: 'P0001', message: 'campaign ended' } }
        server.members.push({ party_id: p.id, user_id: server.me!, character_id: args.p_character, joined_at: now })
        return { data: p.id, error: null }
      }
      return { data: null, error: null }
    },
    from: () => {
      const filters: [string, unknown][] = []
      let noColumn = false
      const q = {
        select: (cols = '') => { noColumn = server.old && cols.includes('ended_at'); return q },
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q },
        returns: async () => noColumn ? { data: null, error: { code: '42703', message: 'column does not exist' } } : { data: rowsFor(), error: null },
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

import { canUndoEnd, createParty, deleteParty, endParty, joinParty, listEndedParties, listParties, restoreParty, updateStash } from './store'
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
    server.old = false
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

  it('ends a campaign without losing it, and its DM brings it back for everyone', async () => {
    server.me = 'acct-noa'
    const party = await createParty('Garden', 'acct-noa')
    server.me = 'acct-roy'
    await joinParty(party.code, 'acct-roy', 'c-ash')

    expect(await endParty(party.id, 'acct-roy')).toBe(false)
    server.me = 'acct-noa'
    expect(canUndoEnd(party.id)).toBe(true)
    expect(await endParty(party.id, 'acct-noa')).toBe(true)
    expect(await listParties('acct-noa')).toEqual([])
    expect((await listEndedParties('acct-noa')).map(p => p.id)).toEqual([party.id])
    expect(server.members).toHaveLength(2)

    server.me = 'acct-tamir'
    expect(await joinParty(party.code, 'acct-tamir')).toEqual({ ok: false, reason: 'ended' })

    server.me = 'acct-noa'
    expect(await restoreParty(party.id, 'acct-noa')).toBe(true)
    const back = await listParties('acct-noa')
    expect(back.map(p => [p.id, p.code, p.members.length, p.endedAt])).toEqual([[party.id, party.code, 2, undefined]])
    expect(await listEndedParties('acct-noa')).toEqual([])
  })

  it('deletes only an ended campaign for good', async () => {
    const party = await createParty('Heroes', 'acct-roy')
    expect(await deleteParty(party.id, 'acct-roy')).toBe(false)
    await endParty(party.id, 'acct-roy')
    expect(await deleteParty(party.id, 'acct-roy')).toBe(true)
    expect(server.parties.has(party.id)).toBe(false)
    expect(await listEndedParties('acct-roy')).toEqual([])
  })

  it('on a server that still deletes ended campaigns, lists parties and warns that End is final', async () => {
    server.old = true
    const party = await createParty('Heroes', 'acct-roy')
    expect((await listParties('acct-roy')).map(p => p.id)).toEqual([party.id])
    expect(canUndoEnd(party.id)).toBe(false)
  })

  it('device campaigns end, come back and delete the same way', async () => {
    const party = await createParty('Kids table', 'local-1')
    expect(canUndoEnd(party.id)).toBe(true)
    await endParty(party.id, 'local-1')
    expect(await listParties('local-1')).toEqual([])
    expect((await joinParty(party.code, 'local-2')).ok).toBe(false)
    await restoreParty(party.id, 'local-1')
    expect((await listParties('local-1')).map(p => p.endedAt)).toEqual([undefined])
    await endParty(party.id, 'local-1')
    expect(await deleteParty(party.id, 'local-1')).toBe(true)
    expect(await listEndedParties('local-1')).toEqual([])
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
