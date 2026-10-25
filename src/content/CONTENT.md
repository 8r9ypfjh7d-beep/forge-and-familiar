# Content library

Every SRD spell, item, magic item, class, class feature, subclass, race, subrace, trait, feat, background, condition, monster, language and proficiency, for both rules editions, as typed JSON the app loads on demand. Nothing here is hand-typed: `scripts/content/ingest.ts` generates `data/` from an upstream source.

## Files Covered

| File | Purpose |
|------|---------|
| `index.ts` | Public API |
| `types.ts` | The data model: one interface per kind, `Choice` for "pick N", `ContentFile`, `ContentManifest`, `ContentPack` |
| `library.ts` | `loadKind`, `getEntry`, `listSources`, `BUNDLED`; `registerContentPack` / `unregisterContentPack` / `onContentChanged` for packs |
| `query.ts` | `searchEntries`, `filterSpells`, `filterMonsters`, `filterEquipment`, `filterMagicItems`, `entryKey` |
| `validate.ts` | `checkContent` (duplicate ids, broken links), `sanitizePack` (packs from files or other devices) |
| `bridge.ts` | `toRulesItem` (library equipment → rules `Item`), `fromHomebrewPack`, `LIBRARY_ID_FOR_RULES_ITEM` |
| `ingest/sources.ts` | SRD 5.1 / 5.2 source info with the CC-BY attribution, upstream file list per kind |
| `ingest/fiveEBits.ts` | Pure normalizers from 5e-bits JSON to the model, both editions |
| `data/<source>/<kind>.json` | Generated. One file per kind, one entry per line |
| `data/<source>/manifest.json` | Generated. Upstream repo and commit, counts |
| `content.test.ts` | Normalizer fixtures, bundled data integrity, rules engine agreement, packs, search |

`scripts/content/ingest.ts` is the CLI (`npm run content:ingest`).

## Source

[5e-bits/5e-database](https://github.com/5e-bits/5e-database), the data behind dnd5eapi.co, read as raw JSON from GitHub. `src/rulesqa` already uses it for the rules text.

- Covers both SRD 5.1 (`src/2014`) and SRD 5.2 (`src/2024`), so editions come from one pipeline.
- SRD only, licensed CC-BY-4.0. Safe to bundle and ship.
- Static files: no API rate limits, can be pinned to a commit, works from a local checkout offline.
- Open5e (api.open5e.com) also carries OGL third-party books. A second adapter could add it later; its entries would need their own `SourceInfo` and OGL notice.
- 5etools data is the full copyrighted books. Not bundled, and there is no importer for it.

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

SRD 5.1 and 5.2 are CC-BY-4.0. Any screen that shows library text must show `source.attribution` for the sources it lists (from `listSources()` or `BUNDLED`), like `src/rulesqa` does.

## Known tasks

- **Refresh the data**: `npm run content:ingest` (network) or `node scripts/content/ingest.ts --from <5e-database checkout>`. `--ref <sha>` pins an upstream commit, `--edition 2014|2024` does one edition, `--strict` fails on broken links. Review the diff: one entry per line.
- **Upstream changed a field**: add a fixture case to `content.test.ts`, then handle it in `ingest/fiveEBits.ts`. Both editions go through the same functions.
- **Add a field to a kind**: add it to `types.ts`, fill it in `ingest/fiveEBits.ts`, regenerate.
- **Add a kind**: add it to `CONTENT_KINDS` and `ContentEntryByKind`, map upstream files in `ingest/sources.ts`, add a normalizer, add links to `checkContent`.
- **Add another source**: write a normalizer next to `fiveEBits.ts` that returns `NormalizedContent` with its own `SourceInfo` (licence and attribution), and a flag in the CLI to pick it.
