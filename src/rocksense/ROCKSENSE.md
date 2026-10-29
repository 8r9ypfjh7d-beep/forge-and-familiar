# Stone Sense (Roy's easter egg)

A party joke: Roy's mountain dwarf uses stonecunning on every rock he sees, and the rock is always very old or slightly moist. Dwarves get a **Sense rock** button on the character card (both sheet modes, so it shows once). Pressing it shakes the screen, drops pebbles, wakes a sleepy boulder and shows one random useless fact plus a "report": Age is always *Very old*, Moisture is random, Usefulness is 0%. A per-device counter keeps score of rocks sensed.

## Files Covered

| File | Purpose |
|------|---------|
| `rocksense.ts` | `canSenseRock` (any race or subrace id with `dwarf`/`mountain`, or the `acct-roy` owner), `pickFact` (never repeats the last one), `pickMoisture`, the per-device count in `ff.rocksSensed.v1.<characterId>` |
| `RockSense.tsx` | `RockSenseButton` and the full-screen moment, portalled to `<body>`; same close rules as the nat 20 moment (`dice/ui/CritFx.tsx`) |
| `rock.css` | Effect styles; allowed hex colours like `crit.css`. Reduce motion (`.is-still`) shows the final frame |
| `rocksense.test.ts` | Who gets the button, fact picking, every fact in English and Hebrew |

## Adding a fact

Add `rock.fact<n>` to `src/i18n/locales/en.ts` and `he.ts`, then raise `ROCK_FACTS`. Keep it useless.
