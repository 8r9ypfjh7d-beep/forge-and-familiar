# Session notes

What happened at each game night. The DM starts a session when the game begins, jots things down while playing, writes the recap afterwards and shares it with the players. Players read the recaps (newest first, "Last time…" on top) and the campaign's open leads. Shown on the campaign page under the lore and as the Sessions tab of the DM screen (`#/dm/sessions`); without a campaign in play the tab offers to open or start one, like Lore.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `SessionNote` (the shared half: number, date, title, recap, people, loot, leads, `sharedAt`), `SessionSecret` (the DM's half: jots, notes, next-time plan), `Lead`, `Jot` |
| `logic.ts` | Pure: `canSee`, `visibleNotes`, `startSession`, `currentSession`, `previousSession`, `lastShared`, `share`/`unshare`, `problems`, jots (`addJot`, `removeJot`, `recapFromJots`), lists (`linesToList`, `linesToLeads`, `addToList`), leads (`addLead`, `toggleLead`, `allLeads`), `unread`, `matches` |
| `store.ts` | Async store: notes `ff.sessionNotes.v1`, private halves `ff.sessionNotes.secrets.v1`, read marks per player per device `ff.sessionNotes.seen.v1`, offline queue `ff.sessionNotes.pending.v1`. (`ff.sessions.v1` belongs to src/schedule polls.) |
| `cloud.ts` | Supabase rows (`session_notes`, `session_note_secrets`) and `watchNotes` |
| `SessionNotes.tsx` | `SessionNotes` section (start, Tonight card with jot box, write-up form, list, leads, viewer) and `SessionBadge` for campaign cards |
| `sessions.css` | Styles scoped to `.ff-sessions` and `.ff-sessions-viewer` (the viewer reuses the lore viewer overlay) |
| `sessions.test.ts` | Visibility, starting, jots, lists, leads, unread, search, rows, offline queue |

## How it works

- **Only the party's DM writes** (`party.dmId`). A note is private until shared; "Hide from players" makes it private again. Players never see the private half, which lives in its own table so the server can hide it whole.
- **Tonight.** "Start tonight's session" makes session N+1 dated today. Its card shows the previous session's next-time plan and how many leads are open, a jot box with four kinds: Moment (private jot with the time), Someone met, Loot and Lead (these go straight into the shared lists, still private until shared).
- **Write the recap.** The form has the recap (lore markup, so `[[Lore title]]` links open lore entries the reader can see), people, loot and leads one per line, then the private notes and next-time plan. "Start from my jots" appends the jots as a list. Saving keeps it private; "Save and share with players" asks once, then shares. Sharing needs a recap.
- **Earlier sessions.** "+ Write up an earlier session" opens the form for a new note that is only saved on Save.
- **Leads** gather across sessions: open ones first, newest session first. The DM ticks them off from the list; players see them struck through.
- **Unread.** A shared note a player has not opened shows "New" and counts in `SessionBadge` on the campaign card.
- **Offline.** A save that can't reach the server is kept on the device and marked pending; the next refresh (mount, realtime event, `online`) sends notes before their private halves and never lets the server copy overwrite a waiting edit.

## Across devices

Cloud parties keep notes in Supabase (`20261101130000_session_notes.sql`): members read shared rows, the DM (and admin) reads and writes everything; `session_note_secrets` is DM-only and must belong to a note of the same party. Deleting a note deletes its private half; ending the campaign deletes both. Local parties keep everything on the device.
