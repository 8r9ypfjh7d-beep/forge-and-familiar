# Character files and level snapshots

Export a character to a `.character.json` file, import one (or a Foundry VTT or Dicecloud character) as a new character, and save level snapshots so a level-up can be rolled back.

## Files Covered

| File | Purpose |
|------|---------|
| `file.ts` | `exportCharacter()`, `parseCharacterFile()` (validates, fills old fields), `asImported()` (new ids, new owner) |
| `foreign.ts` | Foundry VTT and Dicecloud importers: `detectForeign()`, `readFoundry()`, `readDicecloud()` → `ForeignSheet`, `toCharacter()` maps it onto SRD 5.1, `parseForeign()` |
| `snapshots.ts` | `Snapshot`, `takeSnapshot()`, `restoreSnapshot()`, `BUILD_FIELDS` |
| `store.ts` | Snapshot store in localStorage (`ff.snapshots.v1`), async API, max 30 per character |
| `actions.ts` | `exportToFile()`, `importFromFile()`, `parseAnyFile()` (our file, else Foundry/Dicecloud with SRD spell names from `src/content`), `rollBack()` over both stores |
| `download.ts` | Browser file download |
| `ui/` | `ImportButton` (character list), `ExportButton` (character cards, sheet header), `LevelHistory` view (snapshots, rollback, export) |
| `portability.test.ts` | File and snapshot tests |
| `foreign.test.ts` | Foundry and Dicecloud fixtures |

## Notes

- File: `{ format: 'forge-and-familiar/character', version: 1, exportedAt, character, snapshots }`. Bump `FILE_VERSION` only for envelope changes; character changes use `CHARACTER_SCHEMA_VERSION`.
- Import never overwrites: the character and its snapshots get fresh ids and the importing player as owner.
- Import rejects unknown races/classes and levels outside 1–20 so the engine never sees them. Broken snapshots are dropped, not fatal.
- Rollback restores `BUILD_FIELDS` only (race, background, classes, XP, scores, skills, languages, tools, trait picks, ASIs/feats, gear picks). Name, notes, portrait, gear and coins stay; play state is clamped with the sheet's `normalize()`.
- `rollBack()` snapshots the current build first, so a rollback can itself be rolled back.
- Snapshots leave out the portrait to save storage.
- Snapshots sync to the cloud for signed-in accounts (`src/sync/SYNC.md`); a sync conflict saves the losing build as a snapshot.
- A future level-up flow should call `takeSnapshot()` + `addSnapshots()` before applying the new level.

## Foundry VTT and Dicecloud

- Foundry: the dnd5e actor JSON from "Export Data" on the actor. Reads `system` (v10+) and the older `data`; class, subclass, race and background from items or from `details` text.
- Dicecloud: the v2 creature JSON (`/api/creature/<id>`: `creatures`, `creatureProperties`, `creatureVariables`). Race, subrace, subclass and background come from properties tagged `race`, `subrace`, `subclass`, `background`; coin items become coins.
- Both files hold final ability scores, so `toCharacter()` subtracts the SRD racial bonus to get `baseAbilities`. Imports are 2014 rules (SRD 5.1).
- A class outside the SRD refuses the import. Everything else that does not match (race → Human, subclass, spells, languages, expertise) is listed under "Not matched" in the character's notes.
- Platinum becomes 10 gp each and electrum 5 sp. Unmatched items are embedded as custom gear.
- D&D Beyond is not supported: it has no export file, and scraping it is against its terms.
