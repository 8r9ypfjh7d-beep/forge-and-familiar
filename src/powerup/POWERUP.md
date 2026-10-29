# Super Saiyan strip (Tamir's easter egg)

At the table, whenever Tamir's character confronts someone, he takes all his clothes off. His characters get a sheet card that turns this into a Super Saiyan power-up.

## Files Covered

| File | Purpose |
|------|---------|
| `powerup.ts` | `canPowerUp` (owner is `acct-tamir`), `powerUp` / `getDressed` / `isPoweredUp`, `POWER_UP_STATS`, `powerLevel`, the per-device strip counter |
| `PowerUpCard.tsx` | Sheet card: Strip & power up, Get dressed, the buff list and the counter |
| `StripFx.tsx` | Full-screen animation, portalled to `<body>`: clothes fly off, flash, gold hair and aura, censor bar, "Super Saiyan!", power level and a random joke line |
| `strip.fx.css` | Animation styles; base styles are the final frame so reduce motion shows a still card |
| `powerup.css` | Card layout and the warm tint while powered up |
| `powerup.test.ts` | Owner check, layout, buff through `derive()`, lines in both languages |

## Rules

- Only characters with `ownerId === 'acct-tamir'` get the card (`sheetLayout(mode, { powerUp })` puts `'powerUp'` right under the character card, in both modes).
- The buff is real: a custom action with id `act-super-saiyan` and `stats` (+2 attack, +2 damage, +10 ft speed, +3 initiative, −2 AC) switched on, so it shows under Effects on the combat page and in "show the math". It ends with Get dressed, the Effects switch, or Undo. Stripping again replays the animation and reuses the same action.
- Power level is 9001 on the first strip and +1000 each time after; the count lives in localStorage `ff.powerup.v1.<characterId>`, never on `Character`.
- Joke lines are `powerup.line1`..`powerup.line12` (`STRIP_LINES`), in en and he; `pickLine` from `src/dice/fx.ts` avoids repeating the last one. No socks fly off: line 12 says they stay on.
- Reduce motion (a11y panel or OS, `motionReduced()` in `src/dice/ui/RollFx.tsx`) skips the movement and keeps the final frame and words.
