# Build comparison

Compare two builds side by side: two characters, a character and one of its level snapshots, or two what-if level-up options on the same character (for example Fighter 5 vs a Wizard 1 dip, or +2 STR vs +1 DEX/+1 CON).

## Files Covered

| File | Purpose |
|------|---------|
| `compare.ts` | Pure: `applyTweak()` (extra level, ASI), `damagePerRound()`, `compareBuilds()` rows, `featureDiff()` |
| `CompareView.tsx` | The screen: two side pickers, target AC, "only differences" toggle, comparison table |
| `compare.css` | Styles, on the global tokens |
| `compare.test.ts` | Math and comparison tests |

## Notes

- Nothing is saved. Tweaks are applied to a copy; the stored character never changes.
- `asBuild()` clears conditions so play state doesn't skew a build comparison.
- Damage per round: best equipped attack × attacks per action, 5% crits double dice, plus Monk bonus strike and one Sneak Attack. Leaves out spells, Action Surge, Rage, Smite and fighting styles.
- Multiclass prerequisites are not checked yet.
- Reads snapshots through `listSnapshots()` from `src/portability`.
