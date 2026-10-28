# Homebrew change history

Every saved or imported version of a homebrew entry, who made it, what changed field by field, and a restore for the pack author. Generic over any JSON entry with an `id`, so it does not depend on `src/homebrew` types.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Revision`, `RecordInput`, `FieldChange` |
| `revisions.ts` | Pure logic: `diffEntries()`, `changesIn()`, `summarize()`, `nextRevision()` (skips no-op saves), `mergeRevisions()`, `restoreEntry()`, `canRestore()` |
| `store.ts` | localStorage store (`ff.history.v1`, entryId → revisions), async API, max 50 per entry |
| `ui/ChangeHistory.tsx` | Version list with diff table and Restore button; text from `hist.*` keys (English and Hebrew) |
| `history.test.ts` | Diff, numbering, merge and store tests |

## Hooks for the homebrew editor

- After `savePack` in the entry editor: `recordRevision({ kind, entry, authorId, authorName })`. Unchanged saves are ignored.
- After `importPack` returns `added`/`updated`: one `recordRevision({ ..., source: 'import', authorId: pack.authorId, authorName: pack.authorName })` per entry. If the pack file carries `history`, call `importHistory(pack.history)` instead, so friends see the author's real versions.
- On pack export: `history: await historyForSharing(entryIds)` (last 20 per entry).
- On pack delete: `deleteHistory('hb:<packId>:')`.
- `<ChangeHistory entryId userId packAuthorId onRestore>`: `onRestore(entry, meta)` saves through `savePack` and records with `...meta` (source `restore`, `restoredFrom`).

## Notes

- Only the pack author may restore (`canRestore`), matching the rule that only the author edits a pack. Friends see history read-only.
- Restoring adds a new version; it never deletes history, so a restore can itself be undone.
- `updatedAt` is ignored by the diff and by the no-op check.
- Merging: same revision id = same version. A friend's local `import` revision is dropped when the author's history has the same content, and versions are renumbered by time.
- History is per device until accounts and cloud sync exist; sharing it rides along in pack files.
