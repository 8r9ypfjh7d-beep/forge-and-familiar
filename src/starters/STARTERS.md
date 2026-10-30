# Starter heroes

Eight pre-made level 1 heroes for new players, one per class role. Picking one saves a normal `Character` owned by the active player and opens its sheet.

## Files Covered

| File | Purpose |
|------|---------|
| `heroes.ts` | `STARTER_HEROES` data, `createStarter()`, `starterNotes()` |
| `StarterPicker.tsx` | Picker grid with derived AC/HP/attack and "How to play" tips |
| `starters.css` | Picker styles (Liquid Glass, see `src/design/DESIGN.md`) |
| `starters.test.ts` | Every hero passes all builder steps and derives with no warnings |

## Notes

- Each hero is a finished `CharacterDraft` (standard array, a fitting PHB background each: Soldier, Urchin, Acolyte, Sage, Outlander, Noble, Charlatan, Entertainer); `createStarter()` runs it through `createCharacter()` so stats stay derived.
- Backstory, tips and suggested spells are written into `notes`, since there is no spell list yet.
- Adding a hero: append to `STARTER_HEROES`; the tests check it is valid. Class must be unique.
- Picker labels go through `t()` (`starters.*`, `stat.*`); hero names, pitches and tips are English content marked `lang="en" dir="auto"` so they read correctly in Hebrew.
