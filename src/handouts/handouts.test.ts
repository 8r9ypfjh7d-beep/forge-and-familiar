import { describe, expect, it } from 'vitest'
import type { Party } from '../party/types'
import { fitWithin } from './image'
import { canSee, isUnread, markSeen, problems, recipients, send, tableLink, unreadCount, unsend, visibleHandouts } from './logic'
import type { Handout } from './types'

const T = '2026-01-01T00:00:00Z'
const party: Party = {
  id: 'p1', name: 'The Lost Mine', code: 'ABC234', dmId: 'dm',
  members: [{ userId: 'dm', joinedAt: T }, { userId: 'ana', characterId: 'c1', joinedAt: T }, { userId: 'bo', characterId: 'c2', joinedAt: T }],
  createdAt: T, updatedAt: T,
}

const handout = (over: Partial<Handout> = {}): Handout => ({
  id: 'h1', partyId: 'p1', fromId: 'dm', kind: 'note', title: 'A letter', text: 'Meet me at dawn.',
  to: 'all', seenBy: {}, createdAt: T, updatedAt: T, ...over,
})

describe('who sees a hand-out', () => {
  it('hides drafts from players but not from the DM', () => {
    const h = handout()
    expect(canSee(h, party, 'dm')).toBe(true)
    expect(canSee(h, party, 'ana')).toBe(false)
    expect(canSee(send(h), party, 'ana')).toBe(true)
  })

  it('reaches only the chosen players', () => {
    const h = send(handout({ to: ['ana'] }))
    expect(canSee(h, party, 'ana')).toBe(true)
    expect(canSee(h, party, 'bo')).toBe(false)
    expect(recipients(h, party)).toEqual(['ana'])
    expect(recipients(send(handout()), party)).toEqual(['ana', 'bo'])
  })

  it('stops showing to players who left or to other parties', () => {
    const h = send(handout())
    expect(canSee(h, { ...party, members: party.members.filter(m => m.userId !== 'ana') }, 'ana')).toBe(false)
    expect(canSee(h, { ...party, id: 'p2' }, 'dm')).toBe(false)
  })

  it('lets a new DM see the old DM’s hand-outs', () => {
    expect(canSee(handout(), { ...party, dmId: 'ana' }, 'ana')).toBe(true)
  })

  it('lists drafts first, then newest sent', () => {
    const list = [
      handout({ id: 'old', sentAt: '2026-01-02T00:00:00Z' }),
      handout({ id: 'draft' }),
      handout({ id: 'new', sentAt: '2026-01-03T00:00:00Z' }),
    ]
    expect(visibleHandouts(list, party, 'dm').map(h => h.id)).toEqual(['draft', 'new', 'old'])
    expect(visibleHandouts(list, party, 'ana').map(h => h.id)).toEqual(['new', 'old'])
  })
})

describe('read receipts', () => {
  it('counts unread for players only', () => {
    const list = [send(handout({ id: 'a' })), send(handout({ id: 'b', to: ['bo'] })), handout({ id: 'c' })]
    expect(unreadCount(list, party, 'ana')).toBe(1)
    expect(unreadCount(list, party, 'bo')).toBe(2)
    expect(unreadCount(list, party, 'dm')).toBe(0)
  })

  it('keeps the first time a player opened it', () => {
    const h = markSeen(send(handout()), 'ana', '2026-01-05T00:00:00Z')
    expect(isUnread(h, party, 'ana')).toBe(false)
    expect(markSeen(h, 'ana', '2026-02-01T00:00:00Z').seenBy.ana).toBe('2026-01-05T00:00:00Z')
  })

  it('taking a hand-out back makes it a draft again and resets receipts', () => {
    const h = unsend(markSeen(send(handout()), 'ana'))
    expect(h.sentAt).toBeUndefined()
    expect(h.seenBy).toEqual({})
    expect(canSee(h, party, 'ana')).toBe(false)
  })

  it('sending twice keeps the first send time', () => {
    const h = send(handout(), '2026-01-02T00:00:00Z')
    expect(send(h, '2026-01-09T00:00:00Z').sentAt).toBe('2026-01-02T00:00:00Z')
  })
})

describe('checks before sending', () => {
  it('needs a title, the right content, and someone to send to', () => {
    expect(problems(handout())).toEqual([])
    expect(problems(handout({ title: ' ', text: '' }))).toEqual(['title', 'text'])
    expect(problems(handout({ kind: 'map', text: '' }))).toEqual(['image'])
    expect(problems(handout({ kind: 'image', image: 'data:image/jpeg;base64,x', text: '' }))).toEqual([])
    expect(problems(handout({ to: [] }))).toEqual(['recipients'])
  })

  it('a table hand-out needs an https link instead of a picture', () => {
    expect(problems(handout({ kind: 'table', text: '' }))).toEqual(['url'])
    expect(problems(handout({ kind: 'table', text: '', url: 'javascript:alert(1)' }))).toEqual(['url'])
    expect(problems(handout({ kind: 'table', text: '', url: 'http://owlbear.rodeo/room/abc' }))).toEqual(['url'])
    expect(problems(handout({ kind: 'table', text: '', url: 'https://www.owlbear.rodeo/room/abc/Garden' }))).toEqual([])
  })
})

describe('online table links', () => {
  it('names the tabletop site and keeps the link', () => {
    expect(tableLink(' https://www.owlbear.rodeo/room/abc ')).toEqual({ url: 'https://www.owlbear.rodeo/room/abc', site: 'Owlbear Rodeo' })
    expect(tableLink('https://talespire.com/join/x')?.site).toBe('TaleSpire')
    expect(tableLink('https://www.example.org/map')?.site).toBe('example.org')
    expect(tableLink('not a link')).toBeNull()
    expect(tableLink('https://localhost/x')).toBeNull()
  })
})

describe('image sizing', () => {
  it('fits the longer side and never upscales', () => {
    expect(fitWithin(4000, 2000, 2048)).toEqual({ width: 2048, height: 1024 })
    expect(fitWithin(1000, 3000, 1280)).toEqual({ width: 427, height: 1280 })
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 })
  })
})
