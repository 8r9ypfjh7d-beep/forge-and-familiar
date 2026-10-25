# Data model

## Files Covered

| File | Purpose |
|------|---------|
| `character.ts` | `Character`, `CharacterState`, `UserProfile`, `ClassLevel`, `HitDie`, `CustomBackground`, `Improvement` |

## What it is

`Character` is what gets saved. It holds choices (race, classes, base scores, chosen skills, inventory) and `state`, the live play state (HP, slots used, resources used, conditions, counters).

Nothing computable is stored: final scores, max HP, AC, slots and resource maxima come from `src/rules`.

- `ownerId` links a character to a `UserProfile`; friends each have their own list.
- `classes` is an array to leave room for multiclassing; the builder creates one entry.
- `state` is owned by the live sheet; the builder only initialises it (`rules/factory.ts`).
- `quickCast` (optional) lists the entries pinned to the sheet's quick-cast bar; see `src/quickcast/QUICKCAST.md`.
- `spells` (optional) lists known or prepared spells as `{ id, classId }`, ids from the content library; `spellEdition` (optional, `'2024'` or missing for 2014) picks which SRD's spell lists and counts apply. See `src/spellbook/SPELLBOOK.md`.
- `inventory` entries (`InventoryEntry` in `rules/types.ts`): `itemId`, `qty`, `equipped`, plus optional `item` (the full item, embedded for library and custom items so their stats stay editable), `name`, `notes`, `magicBonus` (+1 to +3), `pact` (one warlock pact weapon) and `extraDamage` (e.g. `1d6 fire`). All optional, so old saves need no migration. See `src/inventory/INVENTORY.md`.
- `schemaVersion` lets storage migrate old saves.
- `state.inspiration` and `state.attuned` (max 3 item names) are optional; `normalize()` in `sheet/engine.ts` fills them for old saves.
- `state.counters` with `recharge: 'dawn'` are magic item charges; `regain` is dice notation rolled at dawn (blank refills all). Rests never touch them; `dawn()` in `sheet/engine.ts` does.
- `state.supplies` (optional) holds ammo fired since the last battlefield search and hungry days; see `src/supplies/SUPPLIES.md`.
- `theme` is an optional theme id from `src/themes`; leaving it out means the app default.
- `state.clock` is in-game minutes since day 1, 00:00 (`sheet/clock.ts` formats it). `advanceTime()` runs `dawn()` once for every 06:00 it passes; `setClock()` never recharges.
- Builder choices, all optional so old saves stay valid without a schema bump:
  - `backgroundId: 'custom'` with `customBackground` is the PHB custom background (2 skills, 2 tools or languages, a feature name).
  - `chosenLanguages`, `chosenTools`: picks the race, class and background allow. Fixed languages and tools are added by the engine.
  - `traitChoices`: race trait options, e.g. `{ draconicAncestry: 'red' }`.
  - `improvements`: one per Ability Score Improvement the class levels grant: ability bonuses or a `featId` (SRD or homebrew).
  - `equipmentPicks`: per class equipment choice, the option taken and the items picked for its "any weapon" slots.
  - `classes[].subclassId`: SRD or homebrew subclass.
