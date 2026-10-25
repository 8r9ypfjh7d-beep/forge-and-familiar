# Homebrew

Custom spells, items, feats, races (or subraces of any race) and subclasses a group writes themselves, grouped into packs and shared privately by code or file. Import from `src/homebrew` (index.ts).

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `HomebrewPack`, `HomebrewSpell`, `HomebrewItem`, `HomebrewFeat`, `HomebrewRace`, `HomebrewSubclass`, `FeatEffect` (from rules) |
| `pack.ts` | Pure helpers: entry ids, editor validation, `sanitizePack`, share codes, `describeEffect` |
| `store.ts` | Pack library in localStorage (`ff.homebrew.v1`), async API, registers items with the rules engine |
| `ui/Homebrew.tsx` | Library, import, pack editor, share panel, "Give to" character |
| `ui/forms.tsx` | Spell, item, feat, race and subclass editors |
| `homebrew.test.ts` | Ids, validation, share codes, sanitizing, derive() integration |

## How it works

- Entry ids are `hb:<packId>:<slug>`. The pack id is stable across devices, so a character holding a homebrew item keeps working wherever the pack is imported.
- Every pack on the device is active. `store.ts` calls `registerHomebrewItems` (rules) with all pack items on load, on every write, and on changes from other tabs. `App.tsx` calls `loadHomebrew()` once at startup.
- Homebrew weapons and armor go through the normal engine: attacks, AC, proficiency by category, and carried weight.
- Only the author edits a pack. Friends get a read-only copy and can "Make my own copy" (new pack id, new entry ids).
- Importing a pack that already exists replaces it only when the incoming `updatedAt` is newer.
- Share code: `FFHB1.` + base64url of the pack JSON. Files are the same JSON. Everything imported is rebuilt by `sanitizePack`: unknown fields dropped, numbers clamped, dice checked, ids forced into the pack's own namespace so a pack cannot shadow SRD or another pack's items.
- Feats, races and subclasses are registered with the rules engine too, so the builder lists them. A feat's `effects` apply when a character takes it at an ASI. Packs saved before races/subclasses existed load with empty lists.

## Change history

Uses `src/history` (history thread). Every entry save records a revision; restores go through `sanitizeEntry` and `saveEntry` with the restore meta. Imports record the author's history when the file carries it (`pack.history`), otherwise one `import` revision per entry. Downloaded files include `history`; share codes leave it out to stay short. `history` is never kept in the stored library. Deleting a pack deletes its history.

## Not wired yet

- Feats taken outside the builder (a level-up flow) are not recorded yet.

- Spells are stored and shown here only, until a spellbook/compendium uses them.
