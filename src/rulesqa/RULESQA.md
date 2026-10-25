# Rules Q&A

Ask a rules question in plain words and get the answer quoted from the SRD 5.1, with the section it comes from. No AI service and no network: it is keyword search over the SRD text bundled with the app, so it works offline and never invents a rule.

## Files Covered

| File | Purpose |
|------|---------|
| `index.ts` | Public API: `RulesQA`, `loadRules`, `answer`, `search`, `breadcrumb` |
| `RulesQA.tsx` | The Rules screen: question box, quoted answer, full section, related sections |
| `Markdown.tsx` | Renders the SRD's markdown subset (paragraphs, lists, tables, bold/italic) |
| `search.ts` | Pure TS: tokenizer, stemmer, synonyms, BM25 index, answer and excerpt extraction |
| `load.ts` | Lazy-loads and indexes the SRD text once (separate ~220 KB chunk) |
| `types.ts` | `Passage`, `RulesCorpus`, `SearchHit`, `Answer` |
| `data/srd-rules.json` | Generated: 267 passages from the SRD rules chapters and the 15 conditions |
| `data/build.mjs` | Regenerates the JSON from the 5e-bits/5e-database SRD 5.1 text |
| `rulesqa.test.ts` | Ranking and excerpt tests |

## How answers are found

- The SRD is split into passages at each `##`–`####` heading; long ones are split on paragraphs (~1800 chars).
- BM25 ranking. The deepest heading counts 4×, a question that names a whole heading gets a bonus scaled by how rare its words are, and an exact heading word ("grappling" vs "Grappled") gets a small bonus.
- `SYNONYMS` in `search.ts` maps table talk to SRD wording (AoO, HP, dual wield, nat 20, death saves). Add entries there when a common question misses.
- The answer is the 1–3 consecutive sentences of the best passage that cover the most question words. Table rows come with their header row.
- `weak` is set when the best match is low scoring or misses half the question's own words; the UI then says to check the fit.

## Known tasks

- **A question gets the wrong section**: add a case to `rulesqa.test.ts`, then add a synonym or adjust the weights in `search.ts`.
- **Refresh the SRD text**: `node src/rulesqa/data/build.mjs` (needs network).
- **Licence**: the SRD 5.1 is CC-BY-4.0. Keep `corpus.source` visible on the screen.

## Translations

UI strings are `rulesqa.*` keys in `src/i18n/locales`. The SRD text, example questions and breadcrumbs stay English and are marked `lang="en" dir="ltr"`; the Hebrew screen tells people to ask in English because the search only matches English words.
