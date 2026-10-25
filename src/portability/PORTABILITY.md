# Character files and level snapshots

Export a character to a `.character.json` file, import one as a new character, and save level snapshots so a level-up can be rolled back.

## Files Covered

| File | Purpose |
|------|---------|
| `file.ts` | `exportCharacter()`, `parseCharacterFile()` (validates, fills old fields), `asImported()` (new ids, new owner) |
| `snapshots.ts` | `Snapshot`, `takeSnapshot()`, `restoreSnapshot()`, `BUILD_FIELDS` |
| `store.ts` | Snapshot store in localStorage (`ff.snapshots.v1`), async API, max 30 per character |
| `actions.ts` | `exportToFile()`, `importFromFile()`, `rollBack()` over both stores |
| `download.ts` | Browser file download |
| `ui/` | `ImportButton` (character list), `LevelHistory` view (snapshots, rollback, export) |
| `portability.test.ts` | File and snapshot tests |

## Notes

- File: `{ format: 'forge-and-familiar/character', version: 1, exportedAt, character, snapshots }`. Bump `FILE_VERSION` only for envelope changes; character changes use `CHARACTER_SCHEMA_VERSION`.
- Import never overwrites: the character and its snapshots get fresh ids and the importing player as owner.
- Import rejects unknown races/classes and levels outside 1–20 so the engine never sees them. Broken snapshots are dropped, not fatal.
- Rollback restores `BUILD_FIELDS` only (race, background, classes, XP, scores, skills, languages, tools, trait picks, ASIs/feats, gear picks). Name, notes, portrait, gear and coins stay; play state is clamped with the sheet's `normalize()`.
- `rollBack()` snapshots the current build first, so a rollback can itself be rolled back.
- Snapshots leave out the portrait to save storage.
- A future level-up flow should call `takeSnapshot()` + `addSnapshots()` before applying the new level.
