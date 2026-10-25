# Session recap

Start a session when the table sits down, end it when you stop, and get a recap of what happened: damage, healing, drops to 0, deaths, spell slots and resources, rests, conditions, loot, gold, XP, level ups and every roll.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Session`, `SessionEvent`, `Step`, `Tracked` (saved shape) |
| `diff.ts` | `diffCharacter(before, now)`: two snapshots of a character into events. Pure |
| `journal.ts` | `startSession`, `recordCharacter` (with undo), `recordRolls`, `endSession`. Pure |
| `recap.ts` | `buildRecap(session)`, `recapToText`, `describeEvent`. Pure |
| `store.ts` | Async session store, localStorage key `ff.recaps.v1.<userId>`, `onSessionsChanged` |
| `SessionRecorder.tsx` | Renders nothing. Mounted once in `App.tsx` inside `<DiceProvider>`; records the active session |
| `RecapView.tsx` | Start form, live panel, past sessions, recap page with Copy recap |
| `recap.css` | Styles scoped to `.ff-recap` |
| `recap.test.ts` | Diff, journal and recap tests |

## How it works

- Nothing else in the app knows about sessions. The recorder listens to `onCharactersChanged` and the dice history, and diffs each saved character against its last snapshot.
- Snapshots keep only `Tracked` fields (no portrait), so sessions stay small.
- Undo on the sheet saves the previous character again. Going straight back to the snapshot before the last one within 2 minutes removes that step's events. A later exact reversal (9 damage, then 9 healing) counts as play.
- Rests are inferred, since storage only has the result: full HP while hit dice, slots or resources come back is a long rest; short-rest resources all coming back with nothing else changing is a short rest. A heal to full within 10 minutes of someone else's long rest is counted as that rest, not healing.
- Damage is HP actually lost, so overkill past 0 HP is not counted.
- Rolls are taken from the active player's dice history: rolls by session characters, plus rolls with no character (shown as "Table").
- Recording works across reloads and tabs: updates apply to the latest saved session and are idempotent.

## Limits

- Only sees characters saved on this device, like parties. With a backend, the recorder would run where the DM is and `store.ts` keeps its API.
- A long rest that changes nothing on a character is not seen.
