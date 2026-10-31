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

// ---------- Codex ----------
import { splitDocument, typedTitle } from './importDoc'
import { chaptersFor, closedBlocks, moveEntry, newArrivals, resolveLink, searchEntries, setBlockRevealed, teaserCounts, timeline, toggleTonight, tonightQueue } from './logic'
import { hiddenSegments, parseEntry, parseInline, readableText } from './markup'
import type { LoreChapter } from './types'

const chapter = (over: Partial<LoreChapter> = {}): LoreChapter => ({ id: 'ch1', partyId: 'p1', title: 'The Barony', order: 0, teasers: 0, createdAt: T, updatedAt: T, ...over })

describe('markup', () => {
  it('reads bold, italic and links', () => {
    expect(parseInline('a **b** *c* [[The Mine]]')).toEqual([
      { t: 'text', s: 'a ' }, { t: 'b', s: 'b' }, { t: 'text', s: ' ' }, { t: 'i', s: 'c' }, { t: 'text', s: ' ' }, { t: 'link', title: 'The Mine' },
    ])
  })

  it('numbers hidden blocks and keeps an unmatched marker as text', () => {
    expect(hiddenSegments('one ||two|| three ||four||').filter(s => s.hidden).map(s => s.index)).toEqual([0, 1])
    expect(hiddenSegments('a || b').map(s => s.text)).toEqual(['a ', '|| b'])
  })

  it('keeps a hidden run inside its line and shows it only when revealed', () => {
    const text = 'Dear friends,\n\nThe sender is ||Gundren||.'
    const closed = parseEntry(text, [])
    expect(closed.map(b => b.t)).toEqual(['p', 'p'])
    const p = closed[1]
    const run = p.t === 'p' ? p.inl.find(x => x.t === 'hidden') : undefined
    expect(run && run.t === 'hidden' && run.open).toBe(false)
    expect(readableText(text, [])).toBe('Dear friends, The sender is ████.')
    expect(readableText(text, [0])).toBe('Dear friends, The sender is Gundren.')
    expect(readableText(text, 'all')).toContain('Gundren')
  })

  it('makes a hidden paragraph of its own a block', () => {
    const blocks = parseEntry('Seen:\n\n||\nThe cult meets at the mill.\n||\n\nEnd.', [0])
    expect(blocks.map(b => b.t)).toEqual(['p', 'hidden', 'p'])
    expect(blocks[1].t === 'hidden' && blocks[1].open).toBe(true)
  })

  it('parses headings, lists, quotes and rules', () => {
    expect(parseEntry('# Title\n\n- a\n- b\n\n> hush\n\n---', 'all').map(b => b.t)).toEqual(['h', 'ul', 'quote', 'hr'])
  })
})

describe('hidden blocks on an entry', () => {
  it('reveals and hides one block at a time', () => {
    const h = handout({ text: 'a ||b|| c ||d||' })
    expect(closedBlocks(h)).toBe(2)
    const one = setBlockRevealed(h, 1, true)
    expect(one.revealed).toEqual([1])
    expect(closedBlocks(one)).toBe(1)
    expect(setBlockRevealed(one, 1, false).revealed).toEqual([])
  })
})

describe('chapters', () => {
  const entries = [
    send(handout({ id: 'e1', chapterId: 'ch1', order: 1 })),
    send(handout({ id: 'e2', chapterId: 'ch1', order: 0 })),
    handout({ id: 'e3', chapterId: 'ch1', order: 2, teaser: true }),
    send(handout({ id: 'e4' })),
  ]

  it('groups visible entries by chapter in order, loose ones last', () => {
    const groups = chaptersFor([chapter()], entries, party, 'ana')
    expect(groups.map(g => g.chapter?.id ?? null)).toEqual(['ch1', null])
    expect(groups[0].entries.map(e => e.id)).toEqual(['e2', 'e1'])
    expect(groups[1].entries.map(e => e.id)).toEqual(['e4'])
  })

  it('hides empty chapters from players unless they tease something', () => {
    expect(chaptersFor([chapter({ id: 'ch2', title: 'Empty', order: 1 })], [], party, 'ana')).toEqual([])
    expect(chaptersFor([chapter({ id: 'ch2', teasers: 1 })], [], party, 'ana')).toHaveLength(1)
    expect(chaptersFor([chapter({ id: 'ch2' })], [], party, 'dm')).toHaveLength(1)
  })

  it('counts unrevealed teasers per chapter', () => {
    expect(teaserCounts([chapter()], entries)).toEqual([expect.objectContaining({ teasers: 1 })])
    expect(teaserCounts([chapter({ teasers: 1 })], entries)).toEqual([])
  })

  it('moves an entry inside its chapter', () => {
    const moved = moveEntry(entries, 'e1', -1)
    expect(moved.map(e => [e.id, e.order])).toEqual([['e1', 0], ['e2', 1]])
    expect(moveEntry(entries, 'e2', -1)).toEqual([])
  })
})

describe('tonight, timeline, links and search', () => {
  it('queues drafts and drops them when revealed', () => {
    const a = handout({ id: 'a' })
    const queued = toggleTonight([a], a)
    expect(queued.tonight).toBe(0)
    const b = toggleTonight([queued], handout({ id: 'b' }))
    expect(tonightQueue([b, queued]).map(e => e.id)).toEqual(['a', 'b'])
    expect(send(queued).tonight).toBeUndefined()
    expect(toggleTonight([queued], queued).tonight).toBeUndefined()
  })

  it('orders the story by when it was revealed', () => {
    const list = [send(handout({ id: 'late' }), '2026-02-01T00:00:00Z'), send(handout({ id: 'early' }), '2026-01-01T00:00:00Z'), handout({ id: 'draft' })]
    expect(timeline(list, party, 'ana').map(e => e.id)).toEqual(['early', 'late'])
  })

  it('links only to entries the reader can see', () => {
    const seen = [send(handout({ id: 'x', title: 'The Mine' }))]
    expect(resolveLink('the mine', seen)?.id).toBe('x')
    expect(resolveLink('The Cult', seen)).toBeNull()
  })

  it('searches titles, readable text and meta lines, never closed secrets', () => {
    const list = [send(handout({ id: 'x', title: 'Letter', text: 'Meet at ||the mill||', meta: { from: 'Gundren' } }))]
    expect(searchEntries(list, party, 'ana', 'gundren')).toHaveLength(1)
    expect(searchEntries(list, party, 'ana', 'mill')).toHaveLength(0)
    expect(searchEntries(list, party, 'dm', 'mill')).toHaveLength(1)
  })

  it('finds new arrivals for the reveal moment', () => {
    const list = [send(handout({ id: 'n' }), '2026-03-01T00:00:00Z'), send(handout({ id: 'old' }), '2026-01-01T00:00:00Z')]
    expect(newArrivals(list, party, 'ana', '2026-02-01T00:00:00Z').map(e => e.id)).toEqual(['n'])
    expect(newArrivals(list, party, 'dm', '2026-02-01T00:00:00Z')).toEqual([])
  })
})

describe('pasting a document', () => {
  it('splits chapters and typed entries', () => {
    const doc = '# The Barony\nIt sits on a hill.\n\n## Letter: From Gundren\nDear friends,\n\n## Thundertree\nRuins.\n# People\n## Person: Sildar\nA knight.'
    const out = splitDocument(doc)
    expect(out.map(c => c.title)).toEqual(['The Barony', 'People'])
    expect(out[0].entries.map(e => [e.kind, e.title])).toEqual([['note', 'Overview'], ['letter', 'From Gundren'], ['note', 'Thundertree']])
    expect(out[0].entries[0].text).toBe('It sits on a hill.')
    expect(out[1].entries[0]).toEqual({ kind: 'person', title: 'Sildar', text: 'A knight.' })
  })

  it('puts entries without a chapter under an imported one, in Hebrew too', () => {
    expect(splitDocument('## מכתב: מאת גונדרן\nשלום').map(c => [c.title, c.entries[0].kind])).toEqual([['Imported', 'letter']])
    expect(typedTitle('Rumor: heard at the inn')).toEqual({ kind: 'rumor', title: 'heard at the inn' })
    expect(typedTitle('Note to self: buy rope')).toEqual({ kind: 'note', title: 'Note to self: buy rope' })
  })
})
