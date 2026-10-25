// Saved revision shape. Generic over any JSON entry with an id, so homebrew types can change freely.

/** Why a revision was recorded. */
export type RevisionSource = 'edit' | 'import' | 'restore'

export interface Revision {
  id: string
  /** The entry this is a version of, e.g. `hb:<packId>:<slug>`. */
  entryId: string
  /** Content kind, e.g. 'spells' | 'items' | 'feats'. */
  kind: string
  /** 1 for the first version of an entry, counting up. */
  rev: number
  at: string
  /** UserProfile.id of whoever made the change (the pack author for imports). */
  authorId: string
  authorName?: string
  source: RevisionSource
  /** Optional change note, like a commit message. */
  note?: string
  /** For restores: the rev that was brought back. */
  restoredFrom?: number
  /** The whole entry at this version. */
  entry: unknown
}

export interface RecordInput<E extends { id: string } = { id: string }> {
  kind: string
  entry: E
  authorId: string
  authorName?: string
  source?: RevisionSource
  note?: string
  restoredFrom?: number
}

export type FieldChange =
  | { path: string; type: 'added'; after: unknown }
  | { path: string; type: 'removed'; before: unknown }
  | { path: string; type: 'changed'; before: unknown; after: unknown }
