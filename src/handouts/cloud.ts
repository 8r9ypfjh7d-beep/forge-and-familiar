// Hand-outs in Supabase (supabase/migrations/20261028090000_party_shared.sql). Only the party's DM
// writes them; players read the sent ones addressed to them and mark them read.
import type { SupabaseClient } from '@supabase/supabase-js'
import { watchTable } from '../party/cloud'
import type { Handout } from './types'

interface HandoutRow {
  id: string
  party_id: string
  data: Omit<Handout, 'seenBy'>
  sent_at: string | null
  to_all: boolean
  to_ids: string[]
}

export function toRow(h: Handout): HandoutRow {
  const { seenBy: _s, ...data } = h
  return {
    id: h.id, party_id: h.partyId, data, sent_at: h.sentAt ?? null,
    to_all: h.to === 'all', to_ids: h.to === 'all' ? [] : h.to,
  }
}

/** Rows back into hand-outs, with each one's read receipts. */
export function fromRows(rows: HandoutRow[], seen: { handout_id: string; user_id: string; seen_at: string }[]): Handout[] {
  return rows.map((r): Handout => ({
    ...r.data,
    id: r.id,
    partyId: r.party_id,
    ...(r.sent_at ? { sentAt: r.sent_at } : {}),
    to: r.to_all ? 'all' : r.to_ids,
    seenBy: Object.fromEntries(seen.filter(s => s.handout_id === r.id).map(s => [s.user_id, s.seen_at])),
  })).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** The party's hand-outs this account may see, or null when offline. */
export async function pullHandouts(db: SupabaseClient, partyId: string): Promise<Handout[] | null> {
  const { data: rows, error } = await db.from('handouts').select('id, party_id, data, sent_at, to_all, to_ids').eq('party_id', partyId)
  if (error || !rows) return null
  const ids = rows.map(r => r.id as string)
  const { data: seen, error: e2 } = ids.length
    ? await db.from('handout_seen').select('handout_id, user_id, seen_at').in('handout_id', ids)
    : { data: [], error: null }
  if (e2 || !seen) return null
  return fromRows(rows as HandoutRow[], seen as { handout_id: string; user_id: string; seen_at: string }[])
}

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export async function saveRemote(db: SupabaseClient, h: Handout): Promise<void> {
  check((await db.from('handouts').upsert(toRow(h))).error)
}

/** Taking a hand-out back resets who has read it. */
export async function clearSeen(db: SupabaseClient, id: string): Promise<void> {
  check((await db.from('handout_seen').delete().eq('handout_id', id)).error)
}

export async function deleteRemote(db: SupabaseClient, id: string): Promise<void> {
  check((await db.from('handouts').delete().eq('id', id)).error)
}

export async function markSeenRemote(db: SupabaseClient, id: string, userId: string, at: string): Promise<void> {
  await db.from('handout_seen').upsert({ handout_id: id, user_id: userId, seen_at: at }, { onConflict: 'handout_id,user_id', ignoreDuplicates: true })
}

/** Live updates for one party's hand-outs and read receipts. */
export function watchHandouts(partyId: string, fn: () => void): () => void {
  const a = watchTable('handouts', `party_id=eq.${partyId}`, fn)
  const b = watchTable('handout_seen', undefined, fn)
  return () => { a(); b() }
}
