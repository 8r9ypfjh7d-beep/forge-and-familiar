import { describe, expect, it } from 'vitest'
import { fromRows as handoutsFromRows, toRow as handoutRow } from '../handouts/cloud'
import type { Handout } from '../handouts/types'
import { fromRows as pollsFromRows } from '../schedule/cloud'
import { addOption, makePoll } from '../schedule/poll'

describe('hand-out rows', () => {
  const h: Handout = {
    id: 'h1', partyId: 'p1', fromId: 'acct-roy', kind: 'note', title: 'Letter', text: 'Meet at dawn',
    to: ['acct-tamir'], sentAt: '2026-10-28T09:00:00.000Z', seenBy: { 'acct-tamir': '2026-10-28T09:05:00.000Z' },
    createdAt: '2026-10-28T08:00:00.000Z', updatedAt: '2026-10-28T09:00:00.000Z',
  }

  it('keeps recipients and sent time in columns for the access rules, receipts in their own rows', () => {
    const row = handoutRow(h)
    expect(row).toMatchObject({ id: 'h1', party_id: 'p1', sent_at: h.sentAt, to_all: false, to_ids: ['acct-tamir'] })
    expect('seenBy' in row.data).toBe(false)
    expect(handoutsFromRows([row], [{ handout_id: 'h1', user_id: 'acct-tamir', seen_at: h.seenBy['acct-tamir'] }])).toEqual([h])
  })

  it('reads a draft to everyone back as a draft to all', () => {
    const { sentAt: _s, ...draft } = { ...h, to: 'all' as const, seenBy: {} }
    expect(handoutsFromRows([handoutRow(draft)], [])).toEqual([draft])
  })
})

describe('poll rows', () => {
  it('rebuilds votes per player and drops votes for removed dates', () => {
    const now = new Date('2026-10-28T09:00:00.000Z')
    const p = addOption(makePoll('p1', 'acct-roy', now, 'poll-1'), new Date('2026-11-01T18:00:00.000Z'), 'acct-roy', now, 'o1')
    const { votes: _v, ...data } = p
    const [back] = pollsFromRows([{ id: 'poll-1', party_id: 'p1', data, rev: 1 }], [
      { poll_id: 'poll-1', user_id: 'acct-roy', option_id: 'o1', availability: 'yes' },
      { poll_id: 'poll-1', user_id: 'acct-tamir', option_id: 'o1', availability: 'maybe' },
      { poll_id: 'poll-1', user_id: 'acct-tamir', option_id: 'gone', availability: 'no' },
    ])
    expect(back.votes).toEqual({ 'acct-roy': { o1: 'yes' }, 'acct-tamir': { o1: 'maybe' } })
    expect(back.options).toEqual(p.options)
  })
})
