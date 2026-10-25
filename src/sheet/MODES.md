# Sheet modes (story and combat)

The live sheet has two modes, switched with the Story / Combat buttons under the header. Same data, same components; only which sections show and their order change.

## Files Covered

| File | Purpose |
|------|---------|
| `mode.ts` | `sheetLayout(mode, { dying })` (pure section order), `useSheetMode` (per-character choice) |
| `mode.test.ts` | Layout tests |
| `components/Story.tsx` | Story-only cards: `Identity`, `SocialSkills`, `Notes` |
| `combat/` | The combat page (see `combat/COMBAT_PAGE.md`) |

## Layout

- **Story** (default): who the character is (race, background and feature, alignment, languages, tools, traits), HP, social and exploration skills, notes, inspiration and attunement, rests, clock, stats, slots, resources. No quick-cast bar, turn checklist or reactions.
- **Combat**: laid out like Roll20's character page. A summary on top (who, HP and rests, abilities with Mod and Save, AC and speed), the skills and tools on the side, and tabs: Combat (attacks table, weapon mastery, effects, the player's own actions), Spells (quick-cast, slots, spellbook), Inventory (inventory, supplies), Features & Traits, Notes (notes, identity, history). `sheetLayout` returns these as `vitals` and `tabs`.
- At 0 HP, HP and death saves come first in story mode; combat mode puts death saves above the summary.

## Rules

- The mode is a device preference in localStorage `ff.sheetMode.v1.<characterId>`, never on `Character`.
- Notes edit `Character.notes` through `setNotes` in `engine.ts`, saved on blur so the history gets one entry per edit.
- Adding a sheet section: add its id to `SheetSection`, render it in `CharacterSheet.tsx`'s `section()` switch, and place it in one or both layouts.
