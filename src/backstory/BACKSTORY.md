# Backstory helper

"Draft a backstory" button in the sheet's Notes card (Story mode, and the Notes tab in combat mode). It writes a short backstory, personality, ideal, bond, flaw and a story hook for the DM, then adds it below the notes on "Add to notes" (one undoable history entry).

## Files

| File | Purpose |
|------|---------|
| `draft.ts` | Pure drafter: `draftBackstory(character, names, locale, seed)`, `backstoryText`, `withBackstory`, `alignmentAxis` |
| `phrases.ts` | Story fragments per language: race/species, background, turning point, class calling, traits, ideals by alignment, bonds, flaws, hooks |
| `BackstoryHelper.tsx` | The button and draft panel, rendered inside `sheet/components/Story.tsx` |

## Rules

- Offline, no AI service, no API key. A seed picks one fragment per slot; "Another" moves to the next seed, so tests can pin a draft.
- Every SRD race and class (2014 and 2024) has its own lines; homebrew races, classes and unknown backgrounds use the `'*'` lines, a custom background uses `custom` with its name.
- Ideals follow the alignment: the good/evil axis first, then lawful/chaotic, else neutral.
- `en` and `he` must have the same keys (tested). Hebrew narrative has no gender data on Character, so lines prefer noun phrases; some verbs are masculine.
- A real AI writer (Claude through a Supabase Edge Function) would need Ziv's API key; not added.
