# Coins

Coin converter and even loot split. Opened from the **Coins** chip in the top bar.

## Files Covered

| File | Purpose |
|------|---------|
| `coins.ts` | Pure SRD coin math: `toCp`, `fromCp`, `convert`, `splitLoot`, `addPurses`, formatting |
| `CoinsView.tsx` | Converter panel and loot split panel |
| `coins.css` | Styles scoped to `.ff-coins` |
| `coins.test.ts` | Coin math tests |

## How it works

- Rates: 1 pp = 10 gp = 20 ep = 100 sp = 1,000 cp. All math is done in whole copper.
- Loot is split by value, not coin by coin: 3 pp among 2 is 15 gp each. What doesn't divide evenly (always under one cp per person) is the leftover; keep it for the party fund or give it to one member.
- Split among a plain number of people, or pick a party: every member who brought a character is listed and can be ticked off to sit out. **Add to purses** adds each share to `Character.coins` via `saveCharacter`, re-reading each character first so sheet edits made meanwhile are kept.
- Shares are paid in gp/sp/cp because `Character.coins` only stores those three. If the model gains `pp`/`ep`, pass more denominations to `splitLoot`.
- Like parties, only characters stored on this device can be paid until accounts exist.
