# Sheet modes (story and combat)

The live sheet has two modes, switched with the Story / Combat buttons under the header. Same data, same components; only which sections show and their order change.

## Files Covered

| File | Purpose |
|------|---------|
| `mode.ts` | `sheetLayout(mode, { dying })` (pure section order), `useSheetMode` (per-character choice) |
| `mode.test.ts` | Layout tests |
| `components/Story.tsx` | Story-only cards: `Identity`, `SocialSkills`, `Notes` |

## Layout

- **Story** (default): who the character is (race, background and feature, alignment, languages, tools, traits), HP, social and exploration skills, notes, inspiration and attunement, rests, clock, stats, slots, resources. No quick-cast bar, turn checklist or reactions.
- **Combat**: quick-cast bar on top, then HP, turn checklist, stats (attacks); slots, resources, reactions, supplies, exhaustion, rests.
- At 0 HP, HP and death saves come first in both modes.

## Rules

- The mode is a device preference in localStorage `ff.sheetMode.v1.<characterId>`, never on `Character`.
- Notes edit `Character.notes` through `setNotes` in `engine.ts`, saved on blur so the history gets one entry per edit.
- Adding a sheet section: add its id to `SheetSection`, render it in `CharacterSheet.tsx`'s `section()` switch, and place it in one or both layouts.
