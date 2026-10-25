# Journal (session notes and quest log)

Per-character journal: notes stamped by session date, a quest log with objectives, people met (NPCs) and loot found. Opened from the **Journal** button on a character card.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Journal`, `SessionNote`, `Quest`, `Objective`, `Npc`, `Loot` (saved shape) |
| `journal.ts` | Record factories, `upsert`, `setQuestStatus`, `timeline`, `searchJournal`, `journalToText`. Pure |
| `store.ts` | Async journal store, localStorage key `ff.journal.v1.<characterId>`, `deleteJournalFor`, `onJournalChanged` |
| `JournalView.tsx` | Sessions timeline, Quests, People and Loot tabs, search, Copy as text |
| `notes.css` | Styles scoped to `.ff-notes` |
| `notes.test.ts` | Timeline, search, quest status and text export tests |

## How it works

- Every record carries a session date (YYYY-MM-DD, local time): notes have `date`, people `metOn`, quests `startedOn`/`closedOn`, loot `foundOn`. The Sessions tab groups all of them by that date, so one session shows its notes plus who you met, quests started or closed, and loot found.
- The "Session date" picker sets the stamp for new records. It defaults to the day of a running recap (src/recap) for this character, else today.
- A note can link to a recap session; new notes link to the running recap, or one recorded the same day. Only reads from src/recap.
- Edits save as you type. `updateJournal` applies each change to the latest saved copy, so two open tabs don't drop each other's records.
- Not part of `Character`, so the sheet, rules and recap never see it. `App.tsx` calls `deleteJournalFor` when a character is deleted.

## Limits

- Local to this device, like the rest of the app. Not included in character export files (src/portability) yet.
- Loot is a log; it does not add items to the character's inventory.
