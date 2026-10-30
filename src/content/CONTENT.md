# Content library

Every SRD spell, item, magic item, class, class feature, subclass, race, subrace, trait, feat, background, condition, monster, language and proficiency, for both rules editions, as typed JSON the app loads on demand. `scripts/content/ingest.ts` generates `data/` from an upstream source. `books/` adds the official spells and monsters beyond the SRD, with our own summaries.

## Files Covered

| File | Purpose |
|------|---------|
| `index.ts` | Public API |
| `types.ts` | The data model: one interface per kind, `Choice` for "pick N", `ContentFile`, `ContentManifest`, `ContentPack` |
| `library.ts` | `loadKind`, `getEntry`, `listSources`, `BUNDLED`, `bookMonsterPaths`; `registerContentPack` / `unregisterContentPack` / `onContentChanged` for packs |
| `monsters.ts` | `loadMonsters(edition)`: every monster a campaign can use (SRD, books, legacy older books, packs); `monsterKey`, `monsterName`, `monsterSourceNote` |
| `query.ts` | `searchEntries`, `filterSpells`, `filterMonsters`, `filterEquipment`, `filterMagicItems`, `entryKey` |
| `validate.ts` | `checkContent` (duplicate ids, broken links), `sanitizePack` (packs from files or other devices) |
| `bridge.ts` | `toRulesItem` (library equipment → rules `Item`), `fromHomebrewPack`, `LIBRARY_ID_FOR_RULES_ITEM` |
| `ingest/sources.ts` | SRD 5.1 / 5.2 source info with the CC-BY attribution, upstream file list per kind |
| `ingest/fiveEBits.ts` | Pure normalizers from 5e-bits JSON to the model, both editions |
| `data/<source>/<kind>.json` | Generated. One file per kind, one entry per line |
| `data/<source>/manifest.json` | Generated. Upstream repo and commit, counts |
| `books/sources.ts` | `BOOK_SOURCES` (`books-2014`, `books-2024`), `bookSourceFor`, `BOOK_TITLES` (book code → title) |
| `books/spells-<edition>.json` | Official non-SRD spells for that edition's rules, one per line |
| `books/monsters/<edition>/<BOOK>.json` | Official non-SRD monsters of one book, one per line; the file name is the book code |
| `books/books.test.ts` | Book spell completeness, no SRD overlap, subclass spell names resolve; book monster shape, both summaries, no SRD overlap |
| `monsters.test.ts` | `loadMonsters` per edition, legacy fallback, packs, names and source notes |
| `content.test.ts` | Normalizer fixtures, bundled data integrity, rules engine agreement, packs, search |

`scripts/content/ingest.ts` is the CLI (`npm run content:ingest`).

## Source

[5e-bits/5e-database](https://github.com/5e-bits/5e-database), the data behind dnd5eapi.co, read as raw JSON from GitHub. `src/rulesqa` already uses it for the rules text.

- Covers both SRD 5.1 (`src/2014`) and SRD 5.2 (`src/2024`), so editions come from one pipeline.
- SRD only, licensed CC-BY-4.0. Safe to bundle and ship.
- Static files: no API rate limits, can be pinned to a commit, works from a local checkout offline.
- Open5e (api.open5e.com) also carries OGL third-party books. A second adapter could add it later; its entries would need their own `SourceInfo` and OGL notice.
- 5etools data is the full copyrighted books. Not bundled, and there is no importer for it.

## Book spells

`books/` holds the official spells that the SRD leaves out: the 2014 and 2024 Player's Handbooks, Xanathar's, Tasha's, Wildemount, Fizban's, Strixhaven, Acquisitions Inc., Ravnica, Kwalish, Icewind Dale, Spelljammer, The Book of Many Things, Sigil, A Verdant Tomb, Heroes of Faerûn, Forge of the Artificer and Arcana Unleashed.

- Names and game numbers only (level, school, casting time, range, components, duration, class lists, attack, save, damage dice). `description` is our own short English summary and `descriptionHe` the Hebrew one; never paste the book's text. Material components keep only a gp cost.
- Two shipped sources, `books-2014` and `books-2024`, are listed by `listSources` and loaded by `loadKind` like the SRD, but are not in `BUNDLED` (which stays SRD only). They only have spells.
- `books-2014`: 2014 PHB spells missing from SRD 5.1, plus every 2014-era book. The PHB's wizard-named copies of SRD spells (Tasha's Hideous Laughter) are left out; the SRD names cover them.
- `books-2024`: 2024 PHB spells missing from SRD 5.2, the 2024-era books, then older-book spells with no 2024 reprint, so they stay usable with 2024 rules.
- `Spell.book` is the book code (`XGE`); `BOOK_TITLES` names it. Dunamancy spells (Wildemount) are on the wizard list; Encode Thoughts has no class list in its book.
- Hand-edited. To add a spell: append a line to the matching file with a new `id` (a slug of the name) and both summaries; `books.test.ts` checks the shape.

## Book monsters

`books/monsters/<edition>/<BOOK>.json` holds the official monsters the SRD leaves out, one file per book so each book can be written by its own thread without merge conflicts. The loader globs the folder: a new file is live with no code change, and its name must be a code in `BOOK_TITLES`.

- Same licence rule as book spells: names and game numbers only (size, type, AC, HP, speeds, abilities, saves, skills, senses, CR, XP, attack bonuses, reach and range, damage dice, DCs, uses). Every trait and action has `description` (our own short English summary) and `descriptionHe`; `nameHe` is required; `description`/`descriptionHe` on the monster is a one-line lore summary. Never the book's text. `books.test.ts` checks all of this.
- `book` is the book code. `spellcasting` lists spell groups with library spell ids. `legendary` counts legendary actions and resistances; `lairActions`, `regionalEffects`, `environments` (2014), `initiative`, `gear`, `habitat`, `treasure` (2024) and `tags` are optional.
- A monster in the SRD of the same edition is never repeated (tested by name). A 2014 book monster reprinted in the 2025 Monster Manual gets its own entry under `2024/XMM.json`; one never reprinted is written once under 2014 and `loadMonsters('2024')` shows it as `legacy`.
- Plan and source inventory: `/mnt/project-files/monsters/plan.md` (project files).

### `loadMonsters(edition)`

Every screen that lists monsters (DM screen, combat tracker, NPC sheets, custom monsters) calls `loadMonsters(edition)` from `monsters.ts` rather than `loadKind`, so they agree: the edition's SRD, its book monsters, older-book monsters with no same-name entry (flagged `legacy: true`, not saved), then every registered pack (`hb:<packId>` homebrew, imports) whatever its edition. The same id exists in both editions, so lists and saved references use `monsterKey(m)` = `${source}:${id}`. `monsterName(m, lang, terms)` gives the Hebrew name: SRD monsters from `monster.<id>` terms (`src/i18n/locales/monsters.he.ts`, coverage tested), book and pack monsters from their own `nameHe`; `useI18n().monsterName(m)` wraps it. `monsterSourceNote(m)` is the line to show under a stat block (CC-BY attribution, book title plus the summary note, or the pack's title).

## Data model

- Every entry has `id` (upstream slug), `name`, `source` (`srd-5.1`, `srd-5.2`, `hb:<packId>`, or a pack id) and `edition` (`2014` | `2024`). The same id can exist in both editions (`fireball`), so a saved reference needs the source too: `entryKey(kind, entry)` gives `${source}:${kind}:${id}`.
- Links between entries are `Ref` (`{ id, name }`) or plain id arrays, always within the same source. `checkContent` must report nothing for bundled data (tested).
- Descriptions are markdown strings. 2014 paragraph arrays are joined; list items and table rows stay on adjacent lines. `src/rulesqa/Markdown.tsx` can render them.
- "Choose N" structures (skills, starting gear, languages, ability bonuses) are `Choice` with tagged `ChoiceOption`s. Options the model does not know keep the upstream JSON in `{ kind: 'other', raw }`.
- Edition differences live in the data, not in separate types: 2024 races (species) have `sizes` choices and no ability bonuses, 2024 backgrounds carry `abilityScores` and an origin `feat`, 2024 feats have a `category`, 2024 weapons a `mastery`.
- Glossary ids are `<group>/<index>` (`skill/stealth`, `weapon-property/finesse`) because groups share slugs.

## Runtime

- `import.meta.glob` makes each `data/<source>/<kind>.json` its own lazy chunk; nothing loads until `loadKind` asks. The service worker precaches every chunk, so the library works offline once any screen imports this module. Both editions together are about 3.5 MB raw, roughly 600 KB gzipped.
- Bundled SRD entries come first, then registered packs. `getEntry` without a source returns the first match, so the SRD wins over a pack with the same id.
- Packs: run anything from a file or another device through `sanitizePack` first. It refuses `srd-*` source ids and stamps each entry with the pack's source so imported text can never pose as SRD. The rules engine does not read pack numbers.
- Homebrew (`src/homebrew`) keeps its own store. `fromHomebrewPack` turns a pack into a content pack for the compendium; registering it is up to the screen that lists content.
- The rules engine keeps its own curated data in `src/rules/data`. A test checks that every engine weapon and armor matches the SRD 5.1 library through `toRulesItem`.

## Licence

SRD 5.1 and 5.2 are CC-BY-4.0. Any screen that shows library text must show `source.attribution` for the sources it lists (from `listSources()` or `BUNDLED`), like `src/rulesqa` does. Book spells carry a note that the text is our summary and the names are Wizards of the Coast trademarks; show it with them.

## Known tasks

- **Refresh the data**: `npm run content:ingest` (network) or `node scripts/content/ingest.ts --from <5e-database checkout>`. `--ref <sha>` pins an upstream commit, `--edition 2014|2024` does one edition, `--strict` fails on broken links. Review the diff: one entry per line.
- **Upstream changed a field**: add a fixture case to `content.test.ts`, then handle it in `ingest/fiveEBits.ts`. Both editions go through the same functions.
- **Add a field to a kind**: add it to `types.ts`, fill it in `ingest/fiveEBits.ts`, regenerate.
- **Add a kind**: add it to `CONTENT_KINDS` and `ContentEntryByKind`, map upstream files in `ingest/sources.ts`, add a normalizer, add links to `checkContent`.
- **Add a book's monsters**: add the book code to `BOOK_TITLES` if missing, create `books/monsters/<edition>/<CODE>.json` with the `books-<edition>` source header (copy it from `2014/MM.json`), one entry per line following the rules above, run the tests.
- **Add another source**: write a normalizer next to `fiveEBits.ts` that returns `NormalizedContent` with its own `SourceInfo` (licence and attribution), and a flag in the CLI to pick it.
