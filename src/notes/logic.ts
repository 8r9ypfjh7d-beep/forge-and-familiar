// Pure rules for party notes: who sees a note, the campaign feed, new notes, and moving the DM's old
// session recaps and a character's old private notes in. No storage, no React.
import type { Party } from '../party/types'
import type { SessionNote } from '../sessions/types'
import type { NoteAudience, NoteCategory, NoteKind, PartyNote } from './types'

/** The writer and the party's DM always see a note; others only when it is shared with them. */
export function canSee(n: PartyNote, party: Party, userId: string): boolean {
  if (n.partyId !== party.id) return false
  if (n.authorId === userId || party.dmId === userId) return true
  if (!party.members.some(m => m.userId === userId)) return false
  return n.to === 'all' || (Array.isArray(n.to) && n.to.includes(userId))
}

export const canEdit = (n: PartyNote, userId: string) => n.authorId === userId

/** Diary notes by their day of play, pages by the day they were started. */
const day = (n: PartyNote) => n.playedOn || n.createdAt.slice(0, 10)

/** Newest first. Edits don't move a note, so changing one updates it quietly in place. */
export function byNewest(a: PartyNote, b: PartyNote): number {
  return day(b).localeCompare(day(a)) || b.createdAt.localeCompare(a.createdAt)
}

export interface FeedFilter {
  author?: string
  category?: NoteCategory
  query?: string
}

/** Every note the reader may see, newest first, narrowed by writer, category and words. */
export function feed(list: PartyNote[], party: Party, userId: string, f: FeedFilter = {}): PartyNote[] {
  const q = f.query?.trim().toLowerCase()
  return list
    .filter(n => canSee(n, party, userId))
    .filter(n => !f.author || n.authorId === f.author)
    .filter(n => !f.category || n.category === f.category)
    .filter(n => !q || `${n.title}\n${n.text}`.toLowerCase().includes(q))
    .sort(byNewest)
}

/** The reader's own notes in this party, newest first. */
export const myNotes = (list: PartyNote[], partyId: string, userId: string) =>
  list.filter(n => n.partyId === partyId && n.authorId === userId).sort(byNewest)

/** Today in the device's time zone, YYYY-MM-DD. */
export function today(now = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** A blank note. Diary notes are dated today; new notes go to the whole party unless the writer changes it. */
export function newNote(partyId: string, authorId: string, kind: NoteKind, now = new Date(), id: string = crypto.randomUUID()): PartyNote {
  const at = now.toISOString()
  return { id, partyId, authorId, kind, title: '', text: '', ...(kind === 'diary' ? { playedOn: today(now) } : {}), to: 'all', createdAt: at, updatedAt: at }
}

/** Something to save: a title or some text. */
export const isEmpty = (n: Pick<PartyNote, 'title' | 'text'>) => !n.title.trim() && !n.text.trim()

/** Players chosen by hand, without the writer and the DM (they always see it). An empty choice means only me. */
export function normalizeAudience(to: NoteAudience, party: Party, authorId: string): NoteAudience {
  if (!Array.isArray(to)) return to
  const ids = [...new Set(to)].filter(id => id !== authorId && id !== party.dmId && party.members.some(m => m.userId === id))
  return ids.length ? ids : 'me'
}

/** Short preview without markup. */
export function peek(text: string, max = 160): string {
  const plain = text.replace(/\n+\s*[-*]\s+/g, ' · ').replace(/^\s*[-*]\s+/, '').replace(/\|\|/g, '')
    .replace(/\*\*?|\[\[|\]\]|^#+\s*|^>\s*/gm, '').replace(/\s+/g, ' ').trim()
  return plain.length > max ? plain.slice(0, max - 3).trimEnd() + '…' : plain
}

export const recapNoteId = (sessionId: string) => `recap-${sessionId}`
export const oldNotesId = (partyId: string, characterId: string) => `charnotes-${partyId}-${characterId}`

export interface RecapWords {
  session: (n: number) => string
  people: string
  loot: string
  leads: string
}

/** A DM's shared session recap as a diary note by the DM, shared with the whole party, same date and text. */
export function recapToNote(s: SessionNote, w: RecapWords): PartyNote {
  const list = (label: string, items: string[]) => (items.length ? `**${label}**\n${items.map(x => `- ${x}`).join('\n')}` : '')
  const text = [
    s.recap.trim(),
    list(w.people, s.people),
    list(w.loot, s.loot),
    list(w.leads, s.leads.map(l => (l.doneAt ? `✓ ${l.text}` : l.text))),
  ].filter(Boolean).join('\n\n')
  return {
    id: recapNoteId(s.id), partyId: s.partyId, authorId: s.fromId, kind: 'diary', title: s.title.trim() || w.session(s.number),
    text, playedOn: s.playedOn, to: 'all', createdAt: s.sharedAt ?? s.createdAt, updatedAt: s.updatedAt,
  }
}

/** A character's old Notes box text as the writer's first private page in the campaign. */
export function oldNotesToNote(partyId: string, authorId: string, characterId: string, text: string, title: string, now = new Date()): PartyNote {
  const at = now.toISOString()
  return { id: oldNotesId(partyId, characterId), partyId, authorId, kind: 'page', title, text: text.trim(), to: 'me', createdAt: at, updatedAt: at }
}
