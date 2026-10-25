# Turn

Per-turn checklist on the live sheet: action, bonus action, reaction and movement. Not saved on the character; kept in `sessionStorage` per tab so a reload mid-combat keeps it.

## Files Covered

| File | Purpose |
|------|---------|
| `turn.ts` | Pure `TurnState` updates (`toggle`, `takeReaction`, `move`, `dash`, `nextTurn`), condition `limits`, class `bonusOptions` |
| `useTurn.ts` | Shared store + hook for one character's turn, persisted to `sessionStorage` key `ff-turn:<id>` |
| `TurnChecklist.tsx` | The card; rendered by `sheet/CharacterSheet.tsx` |
| `turn.css` | Styles; relies on the sheet's `--s-*` tokens, so it must sit inside `.ff-sheet` |
| `turn.test.ts` | Rules tests |

## Rules

- **Next turn** resets all three slots, movement and Dash, and counts the round. The reaction resets here too (SRD: it comes back at the start of your turn). **End combat** goes back to round 1.
- Movement is clamped to `speed × (1 + dashes)`. Speed comes from `derive()`, so armor is already applied.
- Grappled or restrained: no movement. Incapacitated, paralyzed, petrified, stunned, unconscious or 0 HP: no actions, reactions or movement.
- Dash does not tick a slot by itself, because rogues may pay for it with a bonus action.
- Reaction options and their triggers live in `src/reactions`. Both cards share one store in `useTurn`, so using a reaction there ticks the box here (`takeReaction`), and either reset clears both.
- UI text goes through `t()` under `turn.*` (English and Hebrew); condition and feature names through `term()`, so `bonusOptions` returns plain SRD feature names.
