import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Party } from '../party/types'
import {
  addJot, addLead, allLeads, canSee, currentSession, emptySecret, lastShared, linesToLeads, linesToList, matches, nextNumber,
  previousSession, problems, recapFromJots, removeJot, share, startSession, toggleLead, today, unread, unshare, visibleNotes,
} from './logic'
import { noteFromRow, noteToRow, secretFromRow, secretToRow } from './cloud'
import type { SessionNote } from './types'

const T = '2026-11-01T10:00:00.000Z'
const party: Party = {
  id: 'p1', name: 'Garden Gang', code: 'ABC234', dmId: 'dm',
  members: [{ userId: 'dm', joinedAt: T }, { userId: 'ana', characterId: 'c1', joinedAt: T }],
  createdAt: T, updatedAt: T,
}
let n = 0
const note = (over: Partial<SessionNote> = {}): SessionNote => ({
  id: `n${++n}`, partyId: 'p1', fromId: 'dm', number: 1, title: '', playedOn: '2026-10-01', recap: 'We met at the inn.',
  people: [], loot: [], leads: [], createdAt: T, updatedAt: T, ...over,
})

describe('who sees a session note', () => {
  it('keeps unshared notes to the DM', () => {
    const a = note()
    expect(canSee(a, party, 'dm')).toBe(true)
    expect(canSee(a, party, 'ana')).toBe(false)
    expect(canSee(share(a, T), party, 'ana')).toBe(true)
    expect(canSee(unshare(share(a, T)), party, 'ana')).toBe(false)
  })

  it('lists newest session first and ignores other parties', () => {
    const list = [note({ number: 1, sharedAt: T }), note({ number: 3, sharedAt: T }), note({ number: 2 }), note({ number: 9, partyId: 'p2', sharedAt: T })]
    expect(visibleNotes(list, party, 'dm').map(x => x.number)).toEqual([3, 2, 1])
    expect(visibleNotes(list, party, 'ana').map(x => x.number)).toEqual([3, 1])
  })

  it('needs a recap before sharing and keeps the first share time', () => {
    expect(problems({ recap: '  ' })).toEqual(['recap'])
    expect(problems({ recap: 'x' })).toEqual([])
    const s = share(note(), T)
    expect(share(s, '2027-01-01T00:00:00.000Z').sharedAt).toBe(T)
  })
})

describe('starting and writing up a session', () => {
  it('numbers tonight after the last one, dated today, private', () => {
    const now = new Date(2026, 10, 1, 20, 0)
    const s = startSession(party, 'dm', [note({ number: 4 }), note({ number: 7, partyId: 'p2' })], now, 'new')
    expect(s).toMatchObject({ id: 'new', number: 5, playedOn: '2026-11-01', recap: '', partyId: 'p1' })
    expect(s.sharedAt).toBeUndefined()
    expect(nextNumber([])).toBe(1)
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('finds the session in play and the one before it', () => {
    const one = note({ number: 1, sharedAt: T }), two = note({ number: 2, sharedAt: T }), three = note({ number: 3 })
    expect(currentSession([one, two, three], party)?.id).toBe(three.id)
    expect(currentSession([one, two], party)).toBeUndefined()
    expect(previousSession([one, two, three], three)?.id).toBe(two.id)
    expect(previousSession([one, two, three], one)).toBeUndefined()
    expect(lastShared([one, two, three], party)?.id).toBe(two.id)
  })

  it('adds and removes jots, skipping blank ones', () => {
    let s = emptySecret({ id: 'x', partyId: 'p1' }, T)
    s = addJot(s, '  ', T, 'j0')
    expect(s.jots).toHaveLength(0)
    s = addJot(s, ' Bribed the guard ', T, 'j1')
    expect(s.jots).toEqual([{ id: 'j1', at: T, text: 'Bribed the guard' }])
    expect(removeJot(s, 'j1', T).jots).toEqual([])
  })

  it('turns jots into a recap list without repeating lines', () => {
    const jots = [{ id: '1', at: T, text: 'Fought goblins' }, { id: '2', at: T, text: 'Found a key' }]
    expect(recapFromJots('', jots)).toBe('- Fought goblins\n- Found a key')
    expect(recapFromJots('The party woke up.', jots)).toBe('The party woke up.\n\n- Fought goblins\n- Found a key')
    expect(recapFromJots('- Fought goblins\n- Found a key', jots)).toBe('- Fought goblins\n- Found a key')
  })

  it('reads lists one per line and keeps lead state across edits', () => {
    expect(linesToList('- Mira\n\n• Old Tom \nMira')).toEqual(['Mira', 'Old Tom'])
    const old = [{ id: 'l1', text: 'Who sent the letter?', doneAt: T }]
    let k = 0
    expect(linesToLeads('Who sent the letter?\nFind the tower', old, () => `new${++k}`)).toEqual([
      { id: 'l1', text: 'Who sent the letter?', doneAt: T }, { id: 'new1', text: 'Find the tower' },
    ])
  })
})

describe('leads across sessions', () => {
  it('lists open leads first and ticks them off', () => {
    let a = note({ number: 1, sharedAt: T })
    a = addLead(addLead(a, 'Find the tower', T, 'l1'), 'Who is the masked man?', T, 'l2')
    expect(addLead(a, 'Find the tower', T, 'dupe').leads).toHaveLength(2)
    a = toggleLead(a, 'l1', T)
    const b = addLead(note({ number: 2 }), 'Secret plan', T, 'l3')
    expect(allLeads([a, b], party, 'ana').map(r => r.lead.id)).toEqual(['l2', 'l1'])
    expect(allLeads([a, b], party, 'dm').map(r => r.lead.id)).toEqual(['l3', 'l2', 'l1'])
    expect(toggleLead(a, 'l1', T).leads[0].doneAt).toBeUndefined()
  })
})

describe('unread and search', () => {
  it('counts shared notes a player has not opened', () => {
    const a = note({ sharedAt: T }), b = note({ sharedAt: T }), c = note()
    expect(unread([a, b, c], party, 'ana', [a.id]).map(x => x.id)).toEqual([b.id])
    expect(unread([a, b, c], party, 'dm', [])).toEqual([])
  })

  it('searches recap, people, loot and leads', () => {
    const a = note({ people: ['Mira the smith'], loot: ['+1 dagger'], leads: [{ id: 'l', text: 'The red door' }] })
    expect(matches(a, 'mira')).toBe(true)
    expect(matches(a, 'DAGGER')).toBe(true)
    expect(matches(a, 'red door')).toBe(true)
    expect(matches(a, 'dragon')).toBe(false)
  })
})

describe('rows', () => {
  it('round-trips notes and private halves', () => {
    const a = note({ sharedAt: T })
    expect(noteToRow(a).shared_at).toBe(T)
    expect(noteFromRow(noteToRow(a))).toEqual(a)
    const b = note()
    expect(noteFromRow(noteToRow(b))).toEqual(b)
    const s = { ...emptySecret(a, T), notes: 'The duke lies' }
    expect(secretFromRow(secretToRow(s))).toEqual(s)
  })
})

// ---------- Store: a save without signal stays on the device and goes up later ----------

const remote = { notes: [] as unknown[], secrets: [] as unknown[], down: false }
vi.mock('../party/store', () => ({ cloudForParty: async () => ({}) }))
vi.mock('./cloud', async orig => {
  const real = await orig<typeof import('./cloud')>()
  const fail = () => { if (remote.down) throw new Error('offline') }
  return {
    ...real,
    saveNoteRemote: async (_db: unknown, x: SessionNote) => { fail(); remote.notes = [...remote.notes.filter(r => (r as SessionNote).id !== x.id), x] },
    saveSecretRemote: async (_db: unknown, x: { id: string }) => { fail(); remote.secrets = [...remote.secrets.filter(r => (r as { id: string }).id !== x.id), x] },
    pullNotes: async () => (remote.down ? null : remote.notes),
    pullSecrets: async () => (remote.down ? null : remote.secrets),
    deleteNoteRemote: async (_db: unknown, id: string) => { fail(); remote.notes = remote.notes.filter(r => (r as SessionNote).id !== id) },
  }
})

describe('session store', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) }, removeItem: (k: string) => { data.delete(k) } })
    vi.stubGlobal('window', new EventTarget())
    remote.notes = []; remote.secrets = []; remote.down = false
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps an offline save and sends it, note before secret, when back online', async () => {
    const { saveNote, saveSecret, listNotes, listSecrets, pendingCount, refreshNotes } = await import('./store')
    remote.down = true
    const a = note({ recap: 'Offline recap' })
    await saveNote(a)
    await saveSecret({ ...emptySecret(a, T), notes: 'secret' })
    expect(pendingCount('p1')).toBe(2)
    await refreshNotes('p1')
    expect((await listNotes('p1'))[0].recap).toBe('Offline recap')
    remote.down = false
    await refreshNotes('p1')
    expect(pendingCount('p1')).toBe(0)
    expect(remote.notes).toHaveLength(1)
    expect(remote.secrets).toHaveLength(1)
    expect((await listSecrets('p1'))[0].notes).toBe('secret')
  })

  it('does not let the server copy overwrite a waiting edit', async () => {
    const { saveNote, listNotes, refreshNotes } = await import('./store')
    const a = note({ recap: 'v1' })
    await saveNote(a)
    remote.down = true
    await saveNote({ ...a, recap: 'v2' })
    remote.down = false
    remote.notes = [{ ...a, recap: 'v1' }]
    await refreshNotes('p1')
    expect((await listNotes('p1'))[0].recap).toBe('v2')
    expect((remote.notes[0] as SessionNote).recap).toBe('v2')
  })

  it('remembers what a player opened', async () => {
    const { markNoteSeen, seenNotes } = await import('./store')
    markNoteSeen('ana', 'n1')
    markNoteSeen('ana', 'n1')
    expect(seenNotes('ana')).toEqual(['n1'])
    expect(seenNotes('bo')).toEqual([])
  })
})
