# Homebrew

Custom spells, items, feats, races (or subraces of any race), subclasses, backgrounds and class options (invocations, metamagic, maneuvers, fighting styles, infusions) a group writes themselves, grouped into packs and shared privately by code or file. Import from `src/homebrew` (index.ts).

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `HomebrewPack`, `HomebrewSpell`, `HomebrewItem`, `HomebrewFeat`, `HomebrewRace`, `HomebrewSubclass`, `HomebrewBackground`, `HomebrewClassOption`, `FeatEffect` (from rules) |
| `pack.ts` | Pure helpers: entry ids, editor validation, `sanitizePack`, share codes, `describeEffect` |
| `store.ts` | Pack library in localStorage (`ff.homebrew.v1`), async API, registers content with the rules engine (`toBackground` maps a pack background) |
| `ui/Homebrew.tsx` | Library, import, pack editor, share panel, "Give to" character |
| `ui/ClassForm.tsx` | Class editor: hit die, saves, proficiencies, casting (type, ability, list, known/prepared, cantrip steps), unarmored defense, subclass level/title, ASI levels, features with uses (fixed, PB, level, modifier, or level steps) and any sheet effect, multiclass rules, why? tips | |
| `ui/forms.tsx` | Spell, item, feat, race, subclass, background and class option editors; `EffectsField` is shared by feats and backgrounds; the class option editor reuses the inventory's `EffectsEditor` (every `ItemEffect`) and has why? bubbles |
| `ui/homebrew.css` | Screen styles on the Liquid Glass standard (`src/design/DESIGN.md`): glass cards, segmented kind tabs, glass fields and buttons |
| `homebrew.test.ts` | Ids, validation, share codes, sanitizing, derive() integration |

## How it works

- Entry ids are `hb:<packId>:<slug>`. The pack id is stable across devices, so a character holding a homebrew item keeps working wherever the pack is imported.
- Every pack on the device is active. `store.ts` calls `registerHomebrewItems` (rules) with all pack items on load, on every write, and on changes from other tabs. `App.tsx` calls `loadHomebrew()` once at startup.
- Homebrew weapons and armor go through the normal engine: attacks, AC, proficiency by category, and carried weight.
- Only the author edits a pack. Friends get a read-only copy and can "Make my own copy" (new pack id, new entry ids).
- Importing a pack that already exists replaces it only when the incoming `updatedAt` is newer.
- Share code: `FFHB1.` + base64url of the pack JSON. Files are the same JSON. Everything imported is rebuilt by `sanitizePack`: unknown fields dropped, numbers clamped, dice checked, ids forced into the pack's own namespace so a pack cannot shadow SRD or another pack's items.
- Feats, races, subclasses and backgrounds are registered with the rules engine too, so the builder lists them. A feat's `effects` apply when a character takes it at an ASI. Packs saved before a kind existed load with an empty list.
- Backgrounds: `editions` is `both`, `2014` or `2024`. They carry skills, fixed and picked tools (an empty pick list means any tool), fixed and picked languages, gear item ids (SRD or homebrew) plus gold, a feature name and text, and for 2024 three ability scores and an Origin feat (SRD or homebrew id, with a note). `effects` apply in both editions (through `getFeats`). Make my own copy re-points a background's feat and gear at the copy's ids. The why? bubbles use `why.hbBg*` keys (explain.en/he.ts).
- Class options (`pack.classOptions`, "Class options" tab) are `ClassOption`s from `rules/classOptions.ts`: kind (invocation, metamagic, maneuver, fighting style, infusion), classes that may pick it, edition, lowest class level, prerequisite text, cost (sorcery points, superiority dice; metamagic may cost per spell level), repeatable, uses (fixed, PB, class level or a modifier, short or long rest) and any `ItemEffect`. Infusions keep their effects and +1–3 bonus under `item` so they go on the infused item, not the artificer. `store.ts` registers them under origin `'homebrew'` (with the pack name as `source`), so every picker that lists `classOptions(kind)` offers them; homebrew fighting styles also join each Fighting Style choice (`classChoices`).

## Change history

Uses `src/history` (history thread). Every entry save records a revision; restores go through `sanitizeEntry` and `saveEntry` with the restore meta. Imports record the author's history when the file carries it (`pack.history`), otherwise one `import` revision per entry. Downloaded files include `history`; share codes leave it out to stay short. `history` is never kept in the stored library. Deleting a pack deletes its history.

## Not wired yet

- Feats taken outside the builder (a level-up flow) are not recorded yet.

- Spells are stored and shown here only, until a spellbook/compendium uses them.
