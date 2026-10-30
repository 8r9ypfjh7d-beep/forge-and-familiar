# Supplies

Ammunition and ration countdowns on the live sheet. Counts are inventory quantities; nothing new is counted twice.

## Files Covered

| File | Purpose |
|------|---------|
| `supplies.ts` | Pure logic: `rangedWeapons`, `ammoForAttack`, `spendAmmo`, `recoverAmmo`, `rationsLeft`, `endDay`, `foodLimit`, `defaultMeal` |
| `Supplies.tsx` | `Supplies` card (Shoot, −1, battlefield search, rations) and `MealChoice` for the long rest dialog |
| `supplies.css` | Card and meal picker styles, inside `.ff-sheet` |
| `supplies.test.ts` | Rule tests |

## Rules (SRD 5.1)

- Ammunition weapons map to arrows (bows) or bolts (crossbows). Each shot takes one from the stacks; empty stacks stay at 0.
- Every attack with that weapon spends a piece: Shoot here, and the bow's row under Attacks and on the combat page (`ammoForAttack` + `spendAmmo`). Out of ammo, the attack still rolls with an "Out of arrows" note.
- Shots are remembered in `state.supplies.ammoSpent`. Searching after a fight recovers half, rounded down. A long rest forgets unsearched shots.
- One long rest is one day. The long rest dialog picks a meal: a ration (taken from inventory), other food, or none.
- Equipment packs hold rations (`packRations` in `rules/data/items.ts`: Explorer's 10, Priest's 2 or 7 in 2024). `rationsLeft` counts loose rations plus the packs' minus `state.supplies.packRationsUsed`; loose ones are eaten first. The pack stays one item, so its weight isn't counted twice.
- Going hungry counts the days; the sheet warns past 3 + CON modifier days (min 1).
- Default meal is a ration when one is carried, otherwise "other food", so tables that skip food tracking never count hungry days by accident.

## Hooks into the sheet

`CharacterSheet.tsx` renders `<Supplies>`. `Rests.tsx` renders `<MealChoice>` and applies `endDay(c, longRest(c), meal)`.
