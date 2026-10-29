# Random generators

Roll a whole random character in the builder, or just a name and a backstory hook.

## Files Covered

| File | Purpose |
|------|---------|
| `generate.ts` | `randomDraft(ownerId, edition, rng)`: a valid level 1 draft (SRD only) with every builder step filled; `randomHookKey()` |
| `names.ts` | `randomName(raceId, rng)`: syllable-built names per race, human style for unknown/homebrew races |
| `RandomBar.tsx` | `RandomCharacter` (top of a new character's builder), `RandomName` (dice next to the name field), `BackstoryHook` (Details step) |
| `random.css` | Styles, on the Liquid Glass standard |
| `random.test.ts` | 400 seeds per edition pass every `stepIssues()` step; every hook exists in English and Hebrew |

## Notes

- Randomness stays out of `src/rules`; every function takes an `rng` so tests use a seeded one.
- Random character keeps the player name and the chosen rules edition, uses the standard array (class's main abilities first, then CON and DEX) and jumps to Details so the player can review or change any step. It asks first if the draft was already touched.
- Hook text is `random.hook.<n>` in the locales (`HOOK_COUNT`). The hook is saved, in the current language, as the new character's story notes. Adding hooks: raise `HOOK_COUNT` and add the key to `en.ts` and `he.ts`.
- Names are our own syllables, not book name lists. Not shown when editing a character.
