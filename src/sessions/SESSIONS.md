# Session notes

The DM's private planning book for each game night: start a session when the game begins, jot things down while playing, keep people met, loot, leads, private notes and the plan for next time. Players never see it. Since 2026-11-11 the story of each game is written by the party in Party notes (src/notes/NOTES.md); shared recaps were moved there and sharing was removed. Shown only as the Sessions tab of the DM screen (`#/dm/sessions`); without a campaign in play the tab offers to open or start one, like Lore.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `SessionNote` (number, date, title, people, loot, leads; legacy `recap` and `sharedAt`), `SessionSecret` (the DM's half: jots, notes, next-time plan), `Lead`, `Jot` |
| `logic.ts` | Pure: `canSee`, `visibleNotes`, `startSession`, `currentSession`, `previousSession`, `unshare`, jots (`addJot`, `removeJot`), lists (`linesToList`, `linesToLeads`, `addToList`), leads (`addLead`, `toggleLead`, `allLeads`), `matches` |
| `store.ts` | Async store: notes `ff.sessionNotes.v1`, private halves `ff.sessionNotes.secrets.v1`, read marks per player per device `ff.sessionNotes.seen.v1`, offline queue `ff.sessionNotes.pending.v1`. (`ff.sessions.v1` belongs to src/schedule polls.) |
| `cloud.ts` | Supabase rows (`session_notes`, `session_note_secrets`) and `watchNotes` |
| `SessionNotes.tsx` | `SessionNotes` section (start, Tonight card with jot box, edit form, list, leads, viewer) |
| `sessions.css` | Styles scoped to `.ff-sessions` and `.ff-sessions-viewer` (the viewer reuses the lore viewer overlay) |
| `sessions.test.ts` | Visibility, starting, jots, lists, leads, unread, search, rows, offline queue |

## How it works

- **Only the party's DM reads and writes** (`party.dmId`). `sharedAt` is legacy: old shared recaps were copied to Party notes and unshared.
- **Tonight.** "Start tonight's session" makes session N+1 dated today. Its card shows the previous session's next-time plan and how many leads are open, a jot box with four kinds: Moment (private jot with the time), Someone met, Loot and Lead (these go straight into the shared lists, still private until shared).
- **Tonight** is the newest session while it is dated today or yesterday (`currentSession`); after that the DM starts the next one.
- **Edit notes.** Number, date, title, people, loot and leads one per line, private notes and next-time plan.
- **Earlier sessions.** "+ Write up an earlier session" opens the form for a new note that is only saved on Save.
- **Leads** gather across sessions: open ones first, newest session first. The DM ticks them off from the list; players see them struck through.
- **Offline.** A save that can't reach the server is kept on the device and marked pending; the next refresh (mount, realtime event, `online`) sends notes before their private halves and never lets the server copy overwrite a waiting edit.

## Across devices

Cloud parties keep notes in Supabase (`20261101130000_session_notes.sql`): members read shared rows, the DM (and admin) reads and writes everything; `session_note_secrets` is DM-only and must belong to a note of the same party. Deleting a note deletes its private half; ending the campaign deletes both. Local parties keep everything on the device.
