# Sheet modes (story and combat)

The live sheet has two modes, switched with the Story / Combat buttons under the header. Same data, same components; only which sections show and their order change.

## Files Covered

| File | Purpose |
|------|---------|
| `mode.ts` | `sheetLayout(mode, { dying })` (pure section order), `useSheetMode` (per-character choice) |
| `mode.test.ts` | Layout tests |
| `components/Story.tsx` | `Identity` (story mode's top card: HP and Rest plus one small line on who the character is), `Notes` |
| `combat/` | The combat page (see `combat/COMBAT_PAGE.md`) |

## Layout

- **Story** (default): one top card with HP and Rest and a small line on race, background, alignment and languages (traits and features folded away); the combat page's abilities (`AbilitiesPanel`) and skills rail (`SkillsPanel`); then notes, story spells (`StorySpells` in src/spellbook: the pinned spells, i.e. the spell entries of `Character.quickCast`, the same list as combat's quick-cast bar), spell slots, attacks and inventory. No quick-cast, resources, ammo and rations, or session log.
- **Combat**: laid out like Roll20's character page. A summary on top (who, HP and rests, abilities with Mod and Save, AC and speed), the skills and tools on the side, and tabs: Combat (attacks table, weapon mastery, effects, the player's own actions), Spells (quick-cast, slots, spellbook), Inventory (inventory, supplies), Features & Traits, Notes (notes, identity, history). `sheetLayout` returns these as `vitals` and `tabs`.
- At 0 HP, both modes put death saves on top.

## Rules

- The mode is a device preference in localStorage `ff.sheetMode.v1.<characterId>`, never on `Character`.
- Notes edit `Character.notes` through `setNotes` in `engine.ts`, saved on blur so the history gets one entry per edit.
- Adding a sheet section: add its id to `SheetSection`, render it in `CharacterSheet.tsx`'s `section()` switch, and place it in one or both layouts.
