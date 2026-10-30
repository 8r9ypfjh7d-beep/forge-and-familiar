# Build planner (src/planner)

Plan a character's levels from now to 20: which class takes each level, the subclass and ASI or feat when a level grants one, and what each level brings. Opened from "Plan to 20" on the character card (App view `plan`).

## Files Covered

| File | Purpose |
|------|---------|
| `plan.ts` | Pure: `routeFor` (one entry per level up to 20), `applyLevel`, `planAt` (the "what if" character at a level), `planSteps` (per-level HP gain, proficiency, new slot level, features, prerequisite issues, missing picks), `setEntry` / `setClass` / `fillWith` (plan edits), `stepLibraryFeatures` |
| `PlanView.tsx` | The screen: fill tools, one glass card per level, level 20 summary, CC-BY source line |
| `planner.css` | Liquid Glass styles (`src/design/DESIGN.md`), logical properties only |
| `planner.test.ts` | Route, picks, prerequisites, plan edits, library feature filter, CSS check |

## Notes

- Saved as `Character.levelPlan` (`PlannedLevel[]`, keyed by character level), so it syncs with the character. It is a plan only: no stat changes until the player levels up through Edit (which still needs the DM's OK for players). Entries at or below the current level are ignored, so the plan stays valid after a level-up.
- A level with no entry takes the class of the level before. Changing one level's class pins the levels after it to their old class, so nothing else moves; picks on that level are dropped.
- Stats come from `derive()` on `planAt()`. Ability score checks ignore item effects (the 20 cap is on the scores).
- Feature chips use the content library (`src/content`, all 20 levels, both editions) and open their rules text; while it loads (or offline before first load) the engine's feature list is used (all 20 levels in both editions). Library text is English and needs the attribution line.
- Comparing two whole builds side by side was cut with Compare (PR #35); the planner shows each level's gains instead.
