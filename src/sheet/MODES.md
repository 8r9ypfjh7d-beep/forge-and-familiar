# Sheet modes (story and combat)

The live sheet has two modes, switched with the Story / Combat buttons under the header. Same data; the shared widgets are identical in both modes and sit in the same place, only the main column differs.

## Files Covered

| File | Purpose |
|------|---------|
| `mode.ts` | `sheetLayout(mode, { dying })` (pure section order), `useSheetMode` (per-character choice) |
| `mode.test.ts` | Layout tests |
| `components/Story.tsx` | `Notes` |
| `components/SpellSlots.tsx` | Slot pips, shown inside the Spells card (`SpellsCard` in src/spellbook) |
| `combat/` | The combat page (see `combat/COMBAT_PAGE.md`) |

## Layout

- **Shared, identical in both modes**: the character card (`CharacterCard` in `combat/CombatPage.tsx`: portrait and level, class, race and background, XP, AC, speed, proficiency, passive perception, Level Up, Initiative, and the HP and Rest cards), the abilities (`AbilitiesPanel`), and on the side the Spells card (`SpellsCard` in src/spellbook: spell slots plus the pinned spells, i.e. the spell entries of `Character.quickCast`, the same list as combat's quick-cast bar) and the skills rail (`SkillsPanel`).
- **Story** (default) main column: notes, attacks and inventory. No quick-cast, resources, ammo and rations, or session log.
- **Combat** main column: Roll20-style tabs: Combat (attacks table, weapon mastery, effects, the player's own actions), Spells (quick-cast, spellbook), Inventory (inventory, supplies), Features & Traits, Notes (notes, history). `sheetLayout` returns these as `tabs`.
- At 0 HP, both modes put death saves on top.
- Rests are one tap in both modes (`components/Rests.tsx`): Short rest applies at once; while hurt, each hit die type gets a one-tap roll. Long rest eats a ration if there is one.

## Rules

- The mode is a device preference in localStorage `ff.sheetMode.v1.<characterId>`, never on `Character`.
- Notes edit `Character.notes` through `setNotes` in `engine.ts`, saved on blur so the history gets one entry per edit.
- A widget meant for both modes goes in `SHARED_TOP` or `SHARED_SIDE` in `mode.ts`, never in one mode only.
- Adding a sheet section: add its id to `SheetSection`, render it in `CharacterSheet.tsx`'s `section()` switch, and place it in one or both layouts.
