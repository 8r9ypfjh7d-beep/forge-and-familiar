// Session polls in Supabase (supabase/migrations/20261028090000_party_shared.sql). The poll (dates,
// chosen date) is one row written conditionally on rev; each player's votes are their own rows.
import type { SupabaseClient } from '@supabase/supabase-js'
import { watchTable } from '../party/cloud'
import type { Availability, SessionPoll } from './types'

interface PollRow {
  id: string
  party_id: string
  data: Omit<SessionPoll, 'votes'>
  rev: number
}

interface VoteRow {
  poll_id: string
  user_id: string
  option_id: string
  availability: Availability
}

/** Rows back into polls. Votes for dates that were removed are left out. */
export function fromRows(rows: PollRow[], votes: VoteRow[]): SessionPoll[] {
  return rows.map(r => {
    const options = new Set(r.data.options.map(o => o.id))
    const byUser: SessionPoll['votes'] = {}
    for (const v of votes) {
      if (v.poll_id !== r.id || !options.has(v.option_id)) continue
      ;(byUser[v.user_id] ??= {})[v.option_id] = v.availability
    }
    return { ...r.data, id: r.id, partyId: r.party_id, votes: byUser }
  })
}

const pollData = ({ votes: _v, ...data }: SessionPoll) => data

/** The party's polls, or null when offline. */
export async function pullPolls(db: SupabaseClient, partyId: string): Promise<SessionPoll[] | null> {
  const { data: rows, error } = await db.from('session_polls').select('id, party_id, data, rev').eq('party_id', partyId)
  if (error || !rows) return null
  const ids = rows.map(r => r.id as string)
  const { data: votes, error: e2 } = ids.length
    ? await db.from('poll_votes').select('poll_id, user_id, option_id, availability').in('poll_id', ids)
    : { data: [], error: null }
  if (e2 || !votes) return null
  return fromRows(rows as PollRow[], votes as VoteRow[])
}

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export async function insertPoll(db: SupabaseClient, p: SessionPoll): Promise<void> {
  check((await db.from('session_polls').insert({ id: p.id, party_id: p.partyId, data: pollData(p) })).error)
}

/** Writes this player's votes on a poll as they are in `next`. */
async function saveMyVotes(db: SupabaseClient, pollId: string, me: string, before: SessionPoll, next: SessionPoll) {
  const old = before.votes[me] ?? {}
  const now = next.votes[me] ?? {}
  const set = Object.entries(now).filter(([o, a]) => old[o] !== a)
  const gone = Object.keys(old).filter(o => !(o in now))
  if (set.length) {
    check((await db.from('poll_votes').upsert(set.map(([option_id, availability]) => ({ poll_id: pollId, user_id: me, option_id, availability })))).error)
  }
  if (gone.length) check((await db.from('poll_votes').delete().eq('poll_id', pollId).eq('user_id', me).in('option_id', gone)).error)
}

/**
 * Applies a pure change (poll.ts) to the server's copy: dates and the chosen date only if nobody
 * else wrote first (else it reads again and re-applies), then this player's own votes.
 */
export async function changePoll(db: SupabaseClient, pollId: string, me: string, fn: (p: SessionPoll) => SessionPoll): Promise<void> {
  for (let tries = 0; tries < 4; tries++) {
    const { data: row, error } = await db.from('session_polls').select('id, party_id, data, rev').eq('id', pollId).maybeSingle<PollRow>()
    check(error)
    if (!row) return
    const { data: votes, error: e2 } = await db.from('poll_votes').select('poll_id, user_id, option_id, availability').eq('poll_id', pollId)
    check(e2)
    const [before] = fromRows([row], (votes ?? []) as VoteRow[])
    const next = fn(before)
    if (next === before) return
    const same = JSON.stringify({ ...pollData(next), updatedAt: '' }) === JSON.stringify({ ...pollData(before), updatedAt: '' })
    if (!same) {
      const { data: done, error: e3 } = await db.from('session_polls').update({ data: pollData(next), rev: row.rev + 1 })
        .eq('id', pollId).eq('rev', row.rev).select('id')
      check(e3)
      if (!done?.length) continue
    }
    await saveMyVotes(db, pollId, me, before, next)
    return
  }
  throw new Error('Someone else changed the poll at the same time. Try again.')
}

/** Live updates for one party's polls and votes. */
export function watchPolls(partyId: string, fn: () => void): () => void {
  const a = watchTable('session_polls', `party_id=eq.${partyId}`, fn)
  const b = watchTable('poll_votes', undefined, fn)
  return () => { a(); b() }
}
