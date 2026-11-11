// Party notes in Supabase (supabase/migrations/20261111060000_party_notes.sql). The server applies the same
// rule as canSee: the writer, the party's DM (and admin), and the players the note is shared with read it;
// only the writer saves or deletes it.
import type { SupabaseClient } from '@supabase/supabase-js'
import { watchTable } from '../party/cloud'
import type { PartyNote } from './types'

export interface NoteRow {
  id: string
  party_id: string
  author_id: string
  to_all: boolean
  to_ids: string[]
  data: Omit<PartyNote, 'id' | 'partyId' | 'authorId' | 'to'>
}

export function noteToRow(n: PartyNote): NoteRow {
  const { id, partyId, authorId, to, ...data } = n
  return { id, party_id: partyId, author_id: authorId, to_all: to === 'all', to_ids: Array.isArray(to) ? to : [], data }
}

export const noteFromRow = (r: NoteRow): PartyNote => ({
  ...r.data, id: r.id, partyId: r.party_id, authorId: r.author_id,
  to: r.to_all ? 'all' : r.to_ids?.length ? r.to_ids : 'me',
})

/** The party's notes this account may read, or null when offline or before the migration ran. */
export async function pullNotes(db: SupabaseClient, partyId: string): Promise<PartyNote[] | null> {
  const { data, error } = await db.from('party_notes').select('id, party_id, author_id, to_all, to_ids, data').eq('party_id', partyId)
  if (error || !data) return null
  return (data as NoteRow[]).map(noteFromRow)
}

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export async function saveNoteRemote(db: SupabaseClient, n: PartyNote): Promise<void> {
  check((await db.from('party_notes').upsert(noteToRow(n))).error)
}

export async function deleteNoteRemote(db: SupabaseClient, id: string): Promise<void> {
  check((await db.from('party_notes').delete().eq('id', id)).error)
}

export const watchNotes = (partyId: string, fn: () => void) => watchTable('party_notes', `party_id=eq.${partyId}`, fn)
