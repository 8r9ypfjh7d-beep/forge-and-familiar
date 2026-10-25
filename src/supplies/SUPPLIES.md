# Supplies

Ammunition and ration countdowns on the live sheet. Counts are inventory quantities; nothing new is counted twice.

## Files Covered

| File | Purpose |
|------|---------|
| `supplies.ts` | Pure logic: `rangedWeapons`, `spendAmmo`, `recoverAmmo`, `endDay`, `foodLimit`, `defaultMeal` |
| `Supplies.tsx` | `Supplies` card (Shoot, −1, battlefield search, rations) and `MealChoice` for the long rest dialog |
| `supplies.css` | Card and meal picker styles, inside `.ff-sheet` |
| `supplies.test.ts` | Rule tests |

## Rules (SRD 5.1)

- Ammunition weapons map to arrows (bows) or bolts (crossbows). Each shot takes one from the stacks; empty stacks stay at 0.
- Shots are remembered in `state.supplies.ammoSpent`. Searching after a fight recovers half, rounded down. A long rest forgets unsearched shots.
- One long rest is one day. The long rest dialog picks a meal: a ration (taken from inventory), other food, or none.
- Going hungry: the long rest does not remove exhaustion, and past 3 + CON modifier days (min 1) each hungry day adds one level.
- Default meal is a ration when one is carried, otherwise "other food", so tables that skip food tracking never get exhaustion by accident.

## Hooks into the sheet

`CharacterSheet.tsx` renders `<Supplies>`. `Rests.tsx` renders `<MealChoice>` and applies `endDay(c, longRest(c), meal)`.
