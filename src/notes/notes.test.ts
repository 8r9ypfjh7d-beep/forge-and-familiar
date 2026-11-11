import { describe, expect, it } from 'vitest'
import type { Party } from '../party/types'
import type { SessionNote } from '../sessions/types'
import { noteFromRow, noteToRow } from './cloud'
import { canEdit, canSee, feed, isEmpty, myNotes, newNote, normalizeAudience, oldNotesToNote, peek, recapToNote } from './logic'
import type { PartyNote } from './types'

const T = '2026-11-01T10:00:00.000Z'
const party: Party = {
  id: 'p1', name: 'Garden Gang', code: 'ABC234', dmId: 'dm',
  members: [{ userId: 'dm', joinedAt: T }, { userId: 'roy', characterId: 'c1', joinedAt: T }, { userId: 'tamir', characterId: 'c2', joinedAt: T }, { userId: 'maayan', characterId: 'c3', joinedAt: T }],
  createdAt: T, updatedAt: T,
}
let k = 0
const note = (over: Partial<PartyNote> = {}): PartyNote => ({
  id: `n${++k}`, partyId: 'p1', authorId: 'roy', kind: 'diary', title: 'Loop', text: 'We broke the loop.', playedOn: '2026-11-01', to: 'all', createdAt: T, updatedAt: T, ...over,
})

describe('who sees a party note', () => {
  it('shows a whole-party note to every member and nobody outside', () => {
    const n = note()
    expect(['roy', 'tamir', 'maayan', 'dm'].every(u => canSee(n, party, u))).toBe(true)
    expect(canSee(n, party, 'stranger')).toBe(false)
    expect(canSee({ ...n, partyId: 'p2' }, party, 'roy')).toBe(false)
  })

  it('keeps an only-me note to the writer and the DM', () => {
    const n = note({ to: 'me' })
    expect(canSee(n, party, 'roy')).toBe(true)
    expect(canSee(n, party, 'dm')).toBe(true)
    expect(canSee(n, party, 'tamir')).toBe(false)
  })

  it('shows a note to chosen players only', () => {
    const n = note({ to: ['tamir'] })
    expect(canSee(n, party, 'tamir')).toBe(true)
    expect(canSee(n, party, 'maayan')).toBe(false)
    expect(canSee(n, party, 'dm')).toBe(true)
  })

  it('lets only the writer edit', () => {
    expect(canEdit(note(), 'roy')).toBe(true)
    expect(canEdit(note(), 'dm')).toBe(false)
  })

  it('cleans the chosen players and falls back to only me', () => {
    expect(normalizeAudience(['tamir', 'roy', 'dm', 'tamir', 'ghost'], party, 'roy')).toEqual(['tamir'])
    expect(normalizeAudience(['roy'], party, 'roy')).toBe('me')
    expect(normalizeAudience('all', party, 'roy')).toBe('all')
  })
})

describe('the feed', () => {
  it('lists newest first by day of play, and edits do not move a note', () => {
    const a = note({ playedOn: '2026-10-01' })
    const b = note({ kind: 'page', playedOn: undefined, createdAt: '2026-10-20T08:00:00.000Z' })
    const c = note({ playedOn: '2026-11-01', updatedAt: '2026-11-09T00:00:00.000Z' })
    expect(feed([a, b, c], party, 'tamir').map(n => n.id)).toEqual([c.id, b.id, a.id])
    expect(feed([{ ...a, updatedAt: '2027-01-01T00:00:00.000Z' }, b, c], party, 'tamir').map(n => n.id)).toEqual([c.id, b.id, a.id])
  })

  it('filters by writer, category and words', () => {
    const a = note({ category: 'npc', title: 'Garrick' }), b = note({ authorId: 'tamir', category: 'quest' }), c = note({ to: 'me', authorId: 'maayan' })
    expect(feed([a, b, c], party, 'roy').map(n => n.id).sort()).toEqual([a.id, b.id].sort())
    expect(feed([a, b, c], party, 'roy', { author: 'tamir' }).map(n => n.id)).toEqual([b.id])
    expect(feed([a, b, c], party, 'roy', { category: 'npc' }).map(n => n.id)).toEqual([a.id])
    expect(feed([a, b, c], party, 'roy', { query: 'garr' }).map(n => n.id)).toEqual([a.id])
    expect(feed([a, b, c], party, 'dm')).toHaveLength(3)
    expect(myNotes([a, b, c], 'p1', 'roy').map(n => n.id)).toEqual([a.id])
  })
})

describe('new notes and moves', () => {
  it('starts a diary dated today and shared with the party', () => {
    const n = newNote('p1', 'roy', 'diary', new Date(2026, 10, 11, 21), 'x')
    expect(n).toMatchObject({ id: 'x', kind: 'diary', playedOn: '2026-11-11', to: 'all', title: '', text: '' })
    expect(newNote('p1', 'roy', 'page', new Date(), 'y').playedOn).toBeUndefined()
    expect(isEmpty(n)).toBe(true)
    expect(isEmpty({ title: ' ', text: 'x' })).toBe(false)
  })

  it('turns a shared recap into a diary note by the DM', () => {
    const s: SessionNote = {
      id: 's1', partyId: 'p1', fromId: 'dm', number: 4, title: '', playedOn: '2026-10-31', recap: 'The loop broke.',
      people: ['Mira'], loot: ['Silver key'], leads: [{ id: 'l1', text: 'Who sent it?' }, { id: 'l2', text: 'The tower', doneAt: T }],
      sharedAt: T, createdAt: T, updatedAt: T,
    }
    const n = recapToNote(s, { session: x => `Session ${x}`, people: 'People met', loot: 'Loot found', leads: 'Leads' })
    expect(n).toMatchObject({ id: 'recap-s1', authorId: 'dm', kind: 'diary', title: 'Session 4', playedOn: '2026-10-31', to: 'all' })
    expect(n.text).toBe('The loop broke.\n\n**People met**\n- Mira\n\n**Loot found**\n- Silver key\n\n**Leads**\n- Who sent it?\n- ✓ The tower')
  })

  it('moves a character\'s old notes in as a private page', () => {
    const n = oldNotesToNote('p1', 'roy', 'c1', '  Hates goblins  ', "Vex's notes")
    expect(n).toMatchObject({ id: 'charnotes-p1-c1', to: 'me', kind: 'page', text: 'Hates goblins', title: "Vex's notes" })
  })

  it('previews without markup', () => {
    expect(peek('**Bold** and [[Lore]]\n- one\n- two')).toBe('Bold and Lore · one · two')
  })
})

describe('rows', () => {
  it('round-trips each audience', () => {
    for (const to of ['all', 'me', ['tamir', 'maayan']] as PartyNote['to'][]) {
      const n = note({ to, category: 'place' })
      const row = noteToRow(n)
      expect(row.to_all).toBe(to === 'all')
      expect(noteFromRow(row)).toEqual(n)
    }
  })
})
