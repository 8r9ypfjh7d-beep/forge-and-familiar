// Session notes in Supabase (supabase/migrations/20261101130000_session_notes.sql). Only the party's DM
// writes. Players read shared notes; the private half sits in session_note_secrets, which only the DM reads.
import type { SupabaseClient } from '@supabase/supabase-js'
import { watchTable } from '../party/cloud'
import type { SessionNote, SessionSecret } from './types'

interface NoteRow {
  id: string
  party_id: string
  data: Omit<SessionNote, 'id' | 'partyId' | 'sharedAt'>
  shared_at: string | null
}

interface SecretRow {
  id: string
  party_id: string
  data: Omit<SessionSecret, 'id' | 'partyId'>
}

export function noteToRow(n: SessionNote): NoteRow {
  const { id, partyId, sharedAt, ...data } = n
  return { id, party_id: partyId, data, shared_at: sharedAt ?? null }
}

export const noteFromRow = (r: NoteRow): SessionNote =>
  ({ ...r.data, id: r.id, partyId: r.party_id, ...(r.shared_at ? { sharedAt: r.shared_at } : {}) })

export function secretToRow(s: SessionSecret): SecretRow {
  const { id, partyId, ...data } = s
  return { id, party_id: partyId, data }
}

export const secretFromRow = (r: SecretRow): SessionSecret => ({ ...r.data, id: r.id, partyId: r.party_id })

/** The party's notes this account may read, or null when offline or before the migration ran. */
export async function pullNotes(db: SupabaseClient, partyId: string): Promise<SessionNote[] | null> {
  const { data, error } = await db.from('session_notes').select('id, party_id, data, shared_at').eq('party_id', partyId)
  if (error || !data) return null
  return (data as NoteRow[]).map(noteFromRow)
}

/** The DM's private halves (players get an empty list from the server), or null when offline. */
export async function pullSecrets(db: SupabaseClient, partyId: string): Promise<SessionSecret[] | null> {
  const { data, error } = await db.from('session_note_secrets').select('id, party_id, data').eq('party_id', partyId)
  if (error || !data) return null
  return (data as SecretRow[]).map(secretFromRow)
}

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export async function saveNoteRemote(db: SupabaseClient, n: SessionNote): Promise<void> {
  check((await db.from('session_notes').upsert(noteToRow(n))).error)
}

export async function saveSecretRemote(db: SupabaseClient, s: SessionSecret): Promise<void> {
  check((await db.from('session_note_secrets').upsert(secretToRow(s))).error)
}

/** Deleting the note deletes its private half too (on delete cascade). */
export async function deleteNoteRemote(db: SupabaseClient, id: string): Promise<void> {
  check((await db.from('session_notes').delete().eq('id', id)).error)
}

/** Live updates for one party's notes and, for the DM, their private halves. */
export function watchNotes(partyId: string, fn: () => void): () => void {
  const a = watchTable('session_notes', `party_id=eq.${partyId}`, fn)
  const b = watchTable('session_note_secrets', `party_id=eq.${partyId}`, fn)
  return () => { a(); b() }
}
