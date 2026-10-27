import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decide, newRequest, removeRequest, setStoryNote } from './logic'
import { pullRequests, pushRequests } from './cloud'
import { listRequests, readSync, saveRequests, updateRequests } from './store'
import { emptySync, fromRow, mergeRows, noteLocalChange, toRow, type RequestRow, type SyncState } from './sync'
import type { DmRequest } from './types'

const req = (id: string, fromId = 'acct-roy'): DmRequest => newRequest({
  fromId, fromName: 'Roy', characterId: 'c-roy', characterName: 'Brin', kind: 'item', title: `Sword ${id}`, details: '',
}, id, '2026-10-27T09:00:00.000Z')

const sync = (s: Partial<SyncState> = {}): SyncState => ({ ...emptySync(), ...s })

describe('request rows', () => {
  it('round-trips a request, leaving out the story note', () => {
    const r = { ...decide([req('a')], 'a', 'later', '2026-10-27T10:00:00.000Z', 'soon')[0], storyNote: 'in the crypt', applied: true }
    const row = toRow(r)
    expect(row).toMatchObject({ id: 'a', from_id: 'acct-roy', character_id: 'c-roy', status: 'later', reply: 'soon', applied: true })
    expect(JSON.stringify(row)).not.toContain('crypt')
    const { storyNote: _s, ...rest } = r
    expect(fromRow(row)).toEqual(rest)
  })
})

describe('noteLocalChange', () => {
  it('marks new and changed requests dirty and removed ones gone and hidden', () => {
    const a = req('a'), b = req('b')
    const s = noteLocalChange([a, b], [{ ...a, title: 'x' }, req('c')], sync({ known: ['a', 'b'] }))
    expect(s.dirty.sort()).toEqual(['a', 'c'])
    expect(s.gone).toEqual(['b'])
    expect(s.hidden).toEqual(['b'])
  })

  it('does not try to delete what the server never had', () => {
    expect(noteLocalChange([req('a')], [], sync()).gone).toEqual([])
  })
})

describe('mergeRows', () => {
  const answered = (r: DmRequest, at = '2026-10-27T10:00:00.000Z') => toRow(decide([r], r.id, 'granted', at, 'yes')[0])

  it('adds new requests and the DM answers', () => {
    const { list, sync: s } = mergeRows([req('a')], [answered(req('a')), toRow(req('b'))], sync({ known: ['a'] }))
    expect(list.map(r => [r.id, r.status])).toEqual([['a', 'granted'], ['b', 'pending']])
    expect(s.known).toEqual(['a', 'b'])
  })

  it('keeps unsent local changes, the story note and applied', () => {
    const local = [{ ...req('a'), storyNote: 'idea', applied: true }, decide([req('b')], 'b', 'denied', '2026-10-27T11:00:00.000Z')[0]]
    const { list } = mergeRows(local, [toRow(req('a')), toRow(req('b'))], sync({ known: ['a', 'b'], dirty: ['b'] }))
    expect(list[0]).toMatchObject({ storyNote: 'idea', applied: true })
    expect(list[1].status).toBe('denied')
  })

  it('drops requests deleted on the server but keeps ones it never had', () => {
    const { list } = mergeRows([req('a'), req('b')], [], sync({ known: ['a'] }))
    expect(list.map(r => r.id)).toEqual(['b'])
  })

  it('does not bring back a request cleared on this device', () => {
    const { list, sync: s } = mergeRows([], [answered(req('a'))], sync({ known: ['a'], hidden: ['a', 'gone-for-good'] }))
    expect(list).toEqual([])
    expect(s.hidden).toEqual(['a'])
  })

  it('keeps a newer answer from a link until the server has it', () => {
    const viaLink = decide([req('a')], 'a', 'granted', '2026-10-27T12:00:00.000Z', 'ok')[0]
    expect(mergeRows([viaLink], [toRow(req('a'))], sync()).list[0].status).toBe('granted')
    // Once synced, the server's answer wins, so the DM can take an answer back.
    expect(mergeRows([viaLink], [toRow(req('a'))], sync({ known: ['a'] })).list[0].status).toBe('pending')
  })
})

/** An in-memory dm_requests table with the server's rules for one caller. */
function fakeDb(me: string, isDm = false) {
  const rows = new Map<string, RequestRow>()
  let offline = false
  const visible = () => [...rows.values()].filter(r => isDm || r.from_id === me)
  const db = {
    from: () => ({
      upsert: (row: RequestRow) => ({
        select: async () => {
          if (offline) return { data: null, error: { message: 'Failed to fetch', code: '' } }
          if (row.from_id !== me) return { data: null, error: { message: 'rls', code: '42501' } }
          const old = rows.get(row.id)
          rows.set(row.id, old ? { ...row, status: old.status, reply: old.reply, decided_at: old.decided_at } : { ...row, status: 'pending', reply: null, decided_at: null, applied: false })
          return { data: [{ id: row.id }], error: null }
        },
      }),
      update: (patch: Partial<RequestRow>) => ({
        eq: (_: string, id: string) => ({
          select: async () => {
            if (offline) return { data: null, error: { message: 'Failed to fetch', code: '' } }
            const old = rows.get(id)
            if (!old || !isDm) return { data: [], error: null }
            rows.set(id, { ...old, ...patch })
            return { data: [{ id }], error: null }
          },
        }),
      }),
      delete: () => ({
        eq: async (_: string, id: string) => {
          if (offline) return { error: { message: 'Failed to fetch', code: '' } }
          if (rows.get(id)?.from_id === me && rows.get(id)?.status === 'pending') rows.delete(id)
          return { error: null }
        },
      }),
      select: async () => (offline ? { data: null, error: { message: 'Failed to fetch' } } : { data: visible(), error: null }),
    }),
  }
  return { db: db as unknown as SupabaseClient, rows, setOffline: (v: boolean) => { offline = v } }
}

describe('push and pull', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    })
    vi.stubGlobal('window', new EventTarget())
  })

  it('sends a new request, then marks it delivered', async () => {
    const server = fakeDb('acct-roy')
    await saveRequests([req('a')])
    expect(await pushRequests(server.db, 'acct-roy')).toBe(true)
    expect(server.rows.get('a')?.status).toBe('pending')
    expect(readSync()).toMatchObject({ known: ['a'], dirty: [], seeded: 'acct-roy' })
  })

  it('keeps changes for later when offline', async () => {
    const server = fakeDb('acct-roy')
    server.setOffline(true)
    await saveRequests([req('a')])
    expect(await pushRequests(server.db, 'acct-roy')).toBe(false)
    expect(readSync().dirty).toEqual(['a'])
    server.setOffline(false)
    expect(await pushRequests(server.db, 'acct-roy')).toBe(true)
    expect(server.rows.has('a')).toBe(true)
  })

  it('sends the first time what this device had from before, and drops what it may not send', async () => {
    const server = fakeDb('acct-roy')
    localStorage.setItem('ff.requests.v1', JSON.stringify([req('old'), req('other', 'acct-tamir')]))
    await pushRequests(server.db, 'acct-roy')
    expect([...server.rows.keys()]).toEqual(['old'])
    expect(readSync().dirty).toEqual([])
  })

  it('DM answer reaches the player; taking back a waiting request deletes it', async () => {
    const shared = fakeDb('acct-roy')
    await saveRequests([req('a'), req('b')])
    await pushRequests(shared.db, 'acct-roy')

    // The DM's device: same rows, DM rules.
    const dm = fakeDb('acct-noa', true)
    for (const [id, row] of shared.rows) dm.rows.set(id, row)
    const playerList = await listRequests()
    const playerSync = readSync()
    localStorage.setItem('ff.requests.v1', '[]')
    localStorage.setItem('ff.requests.sync.v1', JSON.stringify({ ...emptySync(), seeded: 'acct-noa' }))
    await pullRequests(dm.db)
    expect((await listRequests()).map(r => r.id)).toEqual(['a', 'b'])
    await updateRequests(l => setStoryNote(decide(l, 'a', 'granted', '2026-10-27T10:00:00.000Z', 'take it'), 'a', 'secret'))
    await pushRequests(dm.db, 'acct-noa')
    expect(dm.rows.get('a')).toMatchObject({ status: 'granted', reply: 'take it' })
    expect(JSON.stringify(dm.rows.get('a'))).not.toContain('secret')

    // Back on the player's device.
    localStorage.setItem('ff.requests.v1', JSON.stringify(playerList))
    localStorage.setItem('ff.requests.sync.v1', JSON.stringify(playerSync))
    for (const [id, row] of dm.rows) shared.rows.set(id, row)
    await pullRequests(shared.db)
    expect((await listRequests()).find(r => r.id === 'a')).toMatchObject({ status: 'granted', reply: 'take it' })
    await updateRequests(l => removeRequest(l, 'b'))
    await pushRequests(shared.db, 'acct-roy')
    expect(shared.rows.has('b')).toBe(false)
    expect(readSync().gone).toEqual([])
  })
})
