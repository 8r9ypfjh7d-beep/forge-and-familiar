# Sheet modes (story and combat)

The live sheet has two modes, switched with the Story / Combat buttons under the header. Same data; the shared widgets are identical in both modes and sit in the same place. Combat mode never shows the same thing twice.

## Files Covered

| File | Purpose |
|------|---------|
| `mode.ts` | `sheetLayout(mode, { dying })` (pure section order), `useSheetMode` (per-character choice) |
| `mode.test.ts` | Layout tests |
| `components/Story.tsx` | `Notes` |
| `components/SpellSlots.tsx` | Slot pips, shown in story's Spells card (`SpellsCard`) and combat's Spells tab (`Spellbook`), both in src/spellbook |
| `combat/` | The combat page (see `combat/COMBAT_PAGE.md`) |

## Layout

- **Shared, identical in both modes**: the character card (`CharacterCard` in `combat/CombatPage.tsx`: portrait and level, class, race and background, XP, AC, speed, proficiency, passive perception, Level Up, Initiative, and the HP and Rest cards), the abilities (`AbilitiesPanel`), and on the side the skills rail (`SkillsPanel`).
- **Story** (default): the Spells card above the skills (`SpellsCard` in src/spellbook: spell slots plus the pinned spells, i.e. the spell entries of `Character.quickCast`), and a main column of notes, attacks and inventory. No resources, ammo and rations, or session log.
- **Combat** main column: Roll20-style tabs: Combat (attacks table with weapons and attack or save spells, pinned ones included; weapon mastery, effects, the player's own actions), Spells (spell slots and the spellbook), Inventory (inventory, supplies), Features & Traits, Notes (notes, history). `sheetLayout` returns these as `tabs`. There is no Spells card or quick-cast bar here, since the Spells and Combat tabs already hold slots, spells and their rolls (user ask, 2026-10-27).
- At 0 HP, both modes put death saves on top.
- Rests are one tap in both modes (`components/Rests.tsx`): Short rest applies at once; while hurt, each hit die type gets a one-tap roll. Long rest eats a ration if there is one.

## Rules

- The mode is a device preference in localStorage `ff.sheetMode.v1.<characterId>`, never on `Character`.
- Notes edit `Character.notes` through `setNotes` in `engine.ts`, saved on blur so the history gets one entry per edit.
- A widget meant for both modes goes in `SHARED_TOP` or `SHARED_SIDE` in `mode.ts`. Before adding a card to combat mode, check that no tab already shows it.
- Adding a sheet section: add its id to `SheetSection`, render it in `CharacterSheet.tsx`'s `section()` switch, and place it in one or both layouts.
- Look: Liquid Glass (`src/design/DESIGN.md`). `sheet.css` makes every `.card` content glass and every `.btn` a capsule for both modes; the shared widgets (character card, abilities, skills) are styled in the top block of `combat/combat.css`, the combat-only parts below its `/* Tabs */` line. New sheet cards get glass from `.card`; inner tiles use `--glass-thin`, `--r-md`/`--r-sm` and `--glass-hairline` separators.
