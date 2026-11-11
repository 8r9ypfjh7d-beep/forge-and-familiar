// Saved shape of party notes: what players (and the DM) write about their campaign. A note belongs to the
// player who wrote it, not to a character. Only the writer edits it; the writer picks who reads it, and the
// party's DM reads every note.

/** A diary note tells what happened on one day of play; a page is kept and edited (an NPC, a place, a quest). */
export type NoteKind = 'diary' | 'page'

export type NoteCategory = 'npc' | 'place' | 'quest' | 'item' | 'other'
export const NOTE_CATEGORIES: NoteCategory[] = ['npc', 'place', 'quest', 'item', 'other']
export const CATEGORY_ICONS: Record<NoteCategory, string> = { npc: '👤', place: '🏰', quest: '❓', item: '💰', other: '📝' }

/** Who reads it besides the writer and the DM: nobody ('me'), everyone in the party ('all'), or these players. */
export type NoteAudience = 'me' | 'all' | string[]

export interface PartyNote {
  id: string
  partyId: string
  /** UserProfile.id of the writer. */
  authorId: string
  kind: NoteKind
  title: string
  /** Lore markup (src/lore/markup.ts): **bold**, *italic*, lists, [[Lore entry]] links. */
  text: string
  /** Diary notes: the day of play, YYYY-MM-DD. */
  playedOn?: string
  category?: NoteCategory
  to: NoteAudience
  createdAt: string
  updatedAt: string
}

/** What the writer typed but has not saved yet. Kept on this device only, so nobody else sees it. */
export interface NoteDraft {
  note: PartyNote
  /** True while the note was never saved: it is not on the server or in anyone's feed yet. */
  isNew: boolean
  at: string
}
