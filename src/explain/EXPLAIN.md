# Show the math

Tap any number on the live sheet to see how it is built, and a plain-language diff for the undo log.

## Files Covered

| File | Purpose |
|------|---------|
| `math.ts` | `explain(character, key)`: additive breakdown (`lines` sum to `total`) for AC, initiative, speed, proficiency, max HP, passive Perception, spell DC/attack, carrying capacity, ability scores/modifiers, saves, skills, attacks |
| `changes.ts` | `describeChange(before, after)`: "HP 31 → 23" style lines for the undo log |
| `ShowMath.tsx` | `<ShowMath character stat>` button + native popover (portalled to body) |
| `StatsCard.tsx` | Sheet card with abilities, saves, skills, attacks, spellcasting; every number tappable |
| `explain.css` | Popover, stats card and undo-log row styles |
| `explain.test.ts` | Checks every breakdown total against `derive()` for a spread of characters |

## Rules

- `math.ts` mirrors `src/rules/derive.ts`. When a rule changes there, update the matching breakdown; the test fails if they disagree.
- Pure TypeScript, like `src/rules`. No React or storage in `math.ts` / `changes.ts`.
- Undo log (in `src/sheet/useLiveCharacter.ts`): `undoTo(id)` reverts an entry and everything after it, `redo` replays undone entries until the next new change, and undo/redo only restore `state`, so builder edits are kept. The log is kept per character in sessionStorage (`ff.sheetlog.v1.<id>`), without portraits.
