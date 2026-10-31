// The Codex in Supabase (supabase/migrations/20261028090000_party_shared.sql for entries,
// 20261030220000_lore.sql for chapters and the picture bucket). Only the party's DM writes;
// players read revealed entries addressed to them and mark them read.
import type { SupabaseClient } from '@supabase/supabase-js'
import { watchTable } from '../party/cloud'
import type { LoreChapter, LoreEntry } from './types'

interface HandoutRow {
  id: string
  party_id: string
  data: Omit<LoreEntry, 'seenBy'>
  sent_at: string | null
  to_all: boolean
  to_ids: string[]
}

interface ChapterRow {
  id: string
  party_id: string
  data: Omit<LoreChapter, 'id' | 'partyId'>
}

export function toRow(h: LoreEntry): HandoutRow {
  const { seenBy: _s, ...data } = h
  return {
    id: h.id, party_id: h.partyId, data, sent_at: h.sentAt ?? null,
    to_all: h.to === 'all', to_ids: h.to === 'all' ? [] : h.to,
  }
}

/** Rows back into entries, with each one's read receipts. */
export function fromRows(rows: HandoutRow[], seen: { handout_id: string; user_id: string; seen_at: string }[]): LoreEntry[] {
  return rows.map((r): LoreEntry => ({
    ...r.data,
    id: r.id,
    partyId: r.party_id,
    ...(r.sent_at ? { sentAt: r.sent_at } : {}),
    to: r.to_all ? 'all' : r.to_ids,
    seenBy: Object.fromEntries(seen.filter(s => s.handout_id === r.id).map(s => [s.user_id, s.seen_at])),
  })).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export const chapterToRow = (c: LoreChapter): ChapterRow => {
  const { id, partyId, ...data } = c
  return { id, party_id: partyId, data }
}
export const chaptersFromRows = (rows: ChapterRow[]): LoreChapter[] =>
  rows.map(r => ({ ...r.data, id: r.id, partyId: r.party_id })).sort((a, b) => a.order - b.order)

/** The party's entries this account may see, or null when offline. */
export async function pullHandouts(db: SupabaseClient, partyId: string): Promise<LoreEntry[] | null> {
  const { data: rows, error } = await db.from('handouts').select('id, party_id, data, sent_at, to_all, to_ids').eq('party_id', partyId)
  if (error || !rows) return null
  const ids = rows.map(r => r.id as string)
  const { data: seen, error: e2 } = ids.length
    ? await db.from('handout_seen').select('handout_id, user_id, seen_at').in('handout_id', ids)
    : { data: [], error: null }
  if (e2 || !seen) return null
  return fromRows(rows as HandoutRow[], seen as { handout_id: string; user_id: string; seen_at: string }[])
}

/** The party's chapters, or null when offline or before the lore migration ran. */
export async function pullChapters(db: SupabaseClient, partyId: string): Promise<LoreChapter[] | null> {
  const { data, error } = await db.from('lore_chapters').select('id, party_id, data').eq('party_id', partyId)
  if (error || !data) return null
  return chaptersFromRows(data as ChapterRow[])
}

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export async function saveRemote(db: SupabaseClient, h: LoreEntry): Promise<void> {
  check((await db.from('handouts').upsert(toRow(h))).error)
}

export async function saveChapterRemote(db: SupabaseClient, c: LoreChapter): Promise<void> {
  check((await db.from('lore_chapters').upsert(chapterToRow(c))).error)
}

export async function deleteChapterRemote(db: SupabaseClient, id: string): Promise<void> {
  check((await db.from('lore_chapters').delete().eq('id', id)).error)
}

/** Taking an entry back resets who has read it. */
export async function clearSeen(db: SupabaseClient, id: string): Promise<void> {
  check((await db.from('handout_seen').delete().eq('handout_id', id)).error)
}

export async function deleteRemote(db: SupabaseClient, id: string): Promise<void> {
  check((await db.from('handouts').delete().eq('id', id)).error)
}

export async function markSeenRemote(db: SupabaseClient, id: string, userId: string, at: string): Promise<void> {
  await db.from('handout_seen').upsert({ handout_id: id, user_id: userId, seen_at: at }, { onConflict: 'handout_id,user_id', ignoreDuplicates: true })
}

const BUCKET = 'lore'

/** Puts a picture in the `lore` bucket under the party's folder and returns its public link, or null when
 * the bucket is not there yet (the entry then keeps the data URL as before). The path is unguessable. */
export async function uploadPicture(db: SupabaseClient, partyId: string, entryId: string, dataUrl: string): Promise<string | null> {
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${partyId}/${entryId}-${crypto.randomUUID()}.jpg`
  const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) return null
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Best effort: removes an uploaded picture by its public link. */
export async function removePicture(db: SupabaseClient, url: string | undefined): Promise<void> {
  const m = url && /\/object\/public\/lore\/(.+)$/.exec(url)
  if (!m) return
  await db.storage.from(BUCKET).remove([decodeURIComponent(m[1])])
}

/** Live updates for one party's entries, chapters and read receipts. */
export function watchHandouts(partyId: string, fn: () => void): () => void {
  const a = watchTable('handouts', `party_id=eq.${partyId}`, fn)
  const b = watchTable('handout_seen', undefined, fn)
  const c = watchTable('lore_chapters', `party_id=eq.${partyId}`, fn)
  return () => { a(); b(); c() }
}
