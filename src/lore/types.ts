// Saved Codex shape. The Codex is the campaign's lore book: the DM writes chapters of entries in advance
// and reveals them to the players as the party discovers things. An entry is one piece of lore with a
// type that decides how it looks (a letter on parchment, a wanted poster, a map to zoom on...).

export type EntryType =
  | 'note' | 'letter' | 'journal' | 'prophecy' | 'book' | 'poster' | 'rumor'
  | 'place' | 'person' | 'faction' | 'relic' | 'image' | 'map' | 'table'

/** Older name for the entry type, kept for the four kinds hand-outs had. */
export type HandoutKind = EntryType

/** Type-specific lines shown with the text: who wrote the letter, where the rumor was heard... */
export type MetaField = 'from' | 'to' | 'signature' | 'date' | 'author' | 'book' | 'reward' | 'place' | 'role' | 'faction' | 'motto' | 'region'

export interface LoreEntry {
  id: string
  partyId: string
  /** UserProfile.id of the DM who wrote it. */
  fromId: string
  kind: EntryType
  title: string
  /** Body text, markdown-ish (src/lore/markup.ts). `||...||` marks a hidden block the DM reveals later. */
  text: string
  /** Downscaled JPEG data URL, for local parties and as the upload fallback. */
  image?: string
  /** Picture in Supabase Storage (bucket `lore`), used instead of `image` when set. */
  imageUrl?: string
  /** https link to a shared battle map on another site, for 'table' entries. */
  url?: string
  /** 'all' means every player in the party, including ones who join later. */
  to: 'all' | string[]
  /** Unset while it is a draft only the DM can see. Set when revealed. */
  sentAt?: string
  /** userId → when that player first opened it. */
  seenBy: Record<string, string>
  /** Chapter it sits in; unset means the loose "Unsorted" group. */
  chapterId?: string
  /** Position inside its chapter. */
  order?: number
  meta?: Partial<Record<MetaField, string>>
  /** Indexes of the hidden blocks (in text order) the DM has revealed. */
  revealed?: number[]
  /** A draft the players should know exists ("??? something is here"). */
  teaser?: boolean
  /** Position in the DM's "Tonight" queue; unset means not queued. */
  tonight?: number
  createdAt: string
  updatedAt: string
}

/** Older name, kept so the rest of the app reads the same. */
export type Handout = LoreEntry

export interface LoreChapter {
  id: string
  partyId: string
  title: string
  order: number
  /** How many unrevealed teaser entries it holds, kept up to date by the DM's device so players can see "? more to find". */
  teasers: number
  createdAt: string
  updatedAt: string
}

export const ENTRY_TYPES: EntryType[] = ['note', 'letter', 'journal', 'prophecy', 'book', 'poster', 'rumor', 'place', 'person', 'faction', 'relic', 'image', 'map', 'table']

/** Which extra lines each type asks for. */
export const META_FIELDS: Record<EntryType, MetaField[]> = {
  note: [], image: [], map: [], table: [],
  letter: ['from', 'to', 'date', 'signature'],
  journal: ['author', 'date'],
  prophecy: ['author'],
  book: ['book', 'author'],
  poster: ['reward', 'place'],
  rumor: ['place'],
  place: ['region'],
  person: ['role', 'faction'],
  faction: ['motto', 'region'],
  relic: ['place'],
}

/** Types that carry a picture (optional except for image and map). */
export const PICTURE_TYPES: EntryType[] = ['image', 'map', 'poster', 'place', 'person', 'faction', 'relic']
