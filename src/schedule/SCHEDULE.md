# Schedule

Pick the next game date with the party. Shown at the top of an open party in `PartyView`.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `SessionPoll`, `SessionOption`, `Availability` (saved shape) |
| `poll.ts` | Pure rules: propose/remove dates, votes, `tally`, `bestOption`, reminders, `.ics` export |
| `store.ts` | Async poll store (localStorage key `ff.sessions.v1`, also the offline copy of cloud parties' polls), `refreshPolls`, `onSessionsChanged` |
| `cloud.ts` | Supabase rows (`session_polls`, `poll_votes`), `changePoll` (conditional on `rev`, own votes only), `watchPolls` |
| `SessionScheduler.tsx` | The scheduler panel: no plan, open poll, or locked-in session |
| `schedule.css` | Styles scoped to `.ff-schedule` |
| `schedule.test.ts` | Poll rules tests |

## How it works

- One current poll per party (the newest). Anyone in the party starts it and suggests dates; suggesting a date marks you free for it.
- Each member taps their column to cycle ✓ / ? / ✗ / no answer. Only current members are counted.
- Best date: fewest "can't", then most "can", then most "maybe", then soonest; past dates are skipped.
- The DM locks a date in (or changes it). Whoever suggested a date, or the DM, can remove it.
- Reminders: the panel highlights from 24 hours before until the session ends, and "Add to calendar" downloads an `.ics` with a day-before alarm, which works with the app closed.
- After a locked-in session ends (start + 4 hours), the panel offers to plan the next one.
- UI text uses `schedule.*` keys in `src/i18n/locales`; dates and countdowns use the current language through `Intl`. The `.ics` file text stays English.

## Limits until accounts exist

For a cloud party, polls live in Supabase and every member sees dates and votes live; each player can only write their own votes. Local parties keep polls on the device. Push or email reminders need a backend; `poll.ts` has no storage or clock, so it can run there unchanged.
