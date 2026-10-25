# Data model

## Files Covered

| File | Purpose |
|------|---------|
| `character.ts` | `Character`, `CharacterState`, `UserProfile`, `ClassLevel`, `HitDie` |

## What it is

`Character` is what gets saved. It holds choices (race, classes, base scores, chosen skills, inventory) and `state`, the live play state (HP, slots used, resources used, conditions, counters).

Nothing computable is stored: final scores, max HP, AC, slots and resource maxima come from `src/rules`.

- `ownerId` links a character to a `UserProfile`; friends each have their own list.
- `classes` is an array to leave room for multiclassing; the builder creates one entry.
- `state` is owned by the live sheet; the builder only initialises it (`rules/factory.ts`).
- `quickCast` (optional) lists the entries pinned to the sheet's quick-cast bar; see `src/quickcast/QUICKCAST.md`.
- `schemaVersion` lets storage migrate old saves.
- `state.inspiration` and `state.attuned` (max 3 item names) are optional; `normalize()` in `sheet/engine.ts` fills them for old saves.
- `state.counters` with `recharge: 'dawn'` are magic item charges; `regain` is dice notation rolled at dawn (blank refills all). Rests never touch them; `dawn()` in `sheet/engine.ts` does.
- `state.supplies` (optional) holds ammo fired since the last battlefield search and hungry days; see `src/supplies/SUPPLIES.md`.
- `theme` is an optional theme id from `src/themes`; leaving it out means the app default.
