// Pure revision logic: diffing, recording, merging and restoring. Persistence is in store.ts.
import type { FieldChange, RecordInput, Revision } from './types'

/** Revisions kept per entry; the oldest are dropped past this. */
export const MAX_REVISIONS = 50
/** Revisions per entry that travel inside a shared pack. */
export const SHARED_REVISIONS = 20

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Deep equality for JSON values. Object key order does not matter. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameJson(x, b[i]))
  if (isObject(a) && isObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].every(k => sameJson(a[k], b[k]))
  }
  return false
}

/**
 * Field-level changes from `before` to `after`. Objects are walked key by key (paths like
 * `damage.dice`); arrays and scalars are compared whole, so a list shows as one change.
 * `updatedAt` is skipped since it changes on every save.
 */
export function diffEntries(before: unknown, after: unknown, path = ''): FieldChange[] {
  if (sameJson(before, after)) return []
  if (!isObject(before) || !isObject(after)) {
    if (before === undefined) return [{ path, type: 'added', after }]
    if (after === undefined) return [{ path, type: 'removed', before }]
    return [{ path, type: 'changed', before, after }]
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  return keys
    .filter(k => !(path === '' && k === 'updatedAt'))
    .flatMap(k => diffEntries(before[k], after[k], path ? `${path}.${k}` : k))
}

/** What changed in `rev` compared with the version before it. The first version shows every field as added. */
export function changesIn(revisions: Revision[], rev: Revision): FieldChange[] {
  const prev = revisions.filter(r => r.entryId === rev.entryId && r.rev < rev.rev).sort((a, b) => b.rev - a.rev)[0]
  return diffEntries(prev?.entry, rev.entry)
}

/** Short summary for a list row, e.g. "Changed damage.dice, range". */
export function summarize(changes: FieldChange[], max = 3): string {
  if (changes.length === 0) return 'No changes'
  if (changes.length === 1 && changes[0].path === '') return changes[0].type === 'added' ? 'Created' : 'Replaced'
  const names = changes.map(c => c.path)
  const shown = names.slice(0, max).join(', ')
  return names.length > max ? `Changed ${shown} and ${names.length - max} more` : `Changed ${shown}`
}

/**
 * The revision to append for this save, or null when the entry is unchanged since the latest
 * one (so re-saving or re-importing the same pack adds nothing).
 */
export function nextRevision<E extends { id: string }>(existing: Revision[], input: RecordInput<E>, now = new Date()): Revision | null {
  const latest = [...existing].sort((a, b) => b.rev - a.rev)[0]
  if (latest && sameJson(stripVolatile(latest.entry), stripVolatile(input.entry))) return null
  return {
    id: crypto.randomUUID(),
    entryId: input.entry.id,
    kind: input.kind,
    rev: (latest?.rev ?? 0) + 1,
    at: now.toISOString(),
    authorId: input.authorId,
    ...(input.authorName ? { authorName: input.authorName } : {}),
    source: input.source ?? 'edit',
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.restoredFrom !== undefined ? { restoredFrom: input.restoredFrom } : {}),
    entry: structuredClone(input.entry),
  }
}

function stripVolatile(entry: unknown): unknown {
  if (!isObject(entry)) return entry
  const { updatedAt: _, ...rest } = entry
  return rest
}

/**
 * Merges revisions that came with a shared pack into local ones for one entry. Same id = same
 * revision. A local 'import' revision is dropped when the author's history holds the same
 * content, so a friend sees the author's real edits instead of a copy of them.
 * The result is sorted oldest first, renumbered 1..n and capped.
 */
export function mergeRevisions(local: Revision[], incoming: Revision[]): Revision[] {
  const ids = new Set(local.map(r => r.id))
  const fresh = incoming.filter(r => isRevision(r) && !ids.has(r.id))
  const kept = local.filter(r => r.source !== 'import' || !fresh.some(f => sameJson(stripVolatile(f.entry), stripVolatile(r.entry))))
  const all = [...kept, ...fresh].sort((a, b) => a.at.localeCompare(b.at) || a.rev - b.rev)
  const renumbered = all.map((r, i) => (r.rev === i + 1 ? r : { ...r, rev: i + 1 }))
  return renumbered.slice(-MAX_REVISIONS)
}

/** The entry as it was at `rev`, ready to save. The caller records the save with source 'restore'. */
export function restoreEntry<T>(rev: Revision): T {
  return structuredClone(rev.entry) as T
}

/** Only the pack author edits a pack, so only they may restore an old version. */
export const canRestore = (userId: string, packAuthorId: string) => userId === packAuthorId

/** Loose shape check for revisions read from storage or a shared file. */
export function isRevision(v: unknown): v is Revision {
  return isObject(v)
    && typeof v.id === 'string' && typeof v.entryId === 'string' && typeof v.kind === 'string'
    && typeof v.rev === 'number' && typeof v.at === 'string' && typeof v.authorId === 'string'
    && (v.source === 'edit' || v.source === 'import' || v.source === 'restore')
    && isObject(v.entry)
}
