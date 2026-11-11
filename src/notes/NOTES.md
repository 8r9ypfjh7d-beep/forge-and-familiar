# Party notes

Notes players (and the DM) write about their campaign: a **diary** of a game ("we woke up in a time loop…") or a **page** kept and edited (an NPC, a place, a quest). Each player writes on their character sheet while playing; the campaign page and the DM screen's Notes tab (`#/dm/notes`) show every note the reader may see. Replaces the DM's shared session recaps (src/sessions is now the DM's private planning book) and the old private Notes box on the sheet.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `PartyNote` (kind, title, text, `playedOn` for diaries, optional `category`, audience `to`), `NoteDraft`, `NOTE_CATEGORIES`, `CATEGORY_ICONS` |
| `logic.ts` | Pure: `canSee`, `canEdit`, `feed` (newest first, writer/category/word filters), `myNotes`, `newNote`, `normalizeAudience`, `peek`, `recapToNote` (old recaps), `oldNotesToNote` (old sheet Notes box) |
| `store.ts` | Async store: notes `ff.partyNotes.v1`, offline queue `ff.partyNotes.pending.v1`, unsaved drafts `ff.partyNotes.drafts.v1` (this device only) |
| `cloud.ts` | Supabase rows (`party_notes`), `watchNotes` |
| `PartyNotes.tsx` | `PartyNotes` (campaign page, DM Notes tab), `MyNotes` (sheet card), editor, viewer, `usePartyNotes` |
| `notes.css` | Styles scoped to `.ff-notes` and `.ff-notes-viewer` (the viewer reuses the lore viewer overlay) |
| `notes.test.ts` | Visibility, feed order and filters, audience clean-up, recap and old-notes moves, rows |

## How it works

- **Who reads it.** The writer picks: only me, whole party (default), or chosen players. The party's DM reads every note, "only me" ones too. Only the writer edits or deletes; edits update quietly and never move a note in the feed. No comments, reactions or notifications.
- **Writing during play.** "My notes" sits in the sheet's `notes` section (story mode, and combat's Notes tab), only when the character is in the campaign in play; a character outside a campaign has no notes card. Typing is saved as a draft on this device every pause (`saveDraft`), so nothing is lost and nobody else sees it. Save is what shares it. Close keeps the draft ("Not saved yet"); Throw away / Undo my changes drops it.
- **Feed.** Newest first by day of play (diaries) or the day a page was started. Filters: who wrote it, category, and a search box once there are more than six notes. `[[Lore title]]` links open lore entries the reader can see.
- **Old Notes box.** When the sheet opens a character in a campaign and its `Character.notes` has text, it becomes the player's private page "<name>'s notes" (id `charnotes-<party>-<character>`) and the field is cleared. "Draft a backstory" adds a private page.
- **Old recaps.** Each shared session recap becomes a diary note by the DM for the whole party (id `recap-<session>`), with people met, loot and leads folded into the text, and the session goes back to DM-only. The migration did this on the server; the DM's device catches recaps kept locally.

## Across devices

Cloud parties keep notes in Supabase (`20261111060000_party_notes.sql`): readable by the writer, the DM, admin, and members the note is shared with (`to_all` or `to_ids`); inserted and updated only as yourself, in a party you belong to or run; deleted by the writer (or admin). A save that can't reach the server stays pending and goes up on the next refresh. Local parties keep everything on the device.
