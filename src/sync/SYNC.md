# Cloud sync

Characters (with their play state, inventory and coins), level snapshots, roll history, homebrew packs and the DM's NPC sheets save to the server and load on any device the player signs in on with their activation code. Works offline: everything is saved on the device first and uploaded when the connection is back.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `RemoteStore` (what a backend implements), `RemoteRow`, `PushResult`, `SyncStatus` |
| `outbox.ts` | Bookkeeping in `ff.sync.v1`: server revision per character, unsent changes, pull cursors per account |
| `engine.ts` | `syncOnce(remote, ownerId)`: first upload, push, pull, conflicts; `resolveConflict`, `mergeRolls` |
| `packs.ts` | `syncPacks`: the device's homebrew library to and from the account, party members' packs down read-only |
| `npcs.ts` | `syncNpcs`: the DM's NPC sheets (src/npc) to and from their account; owner only |
| `runner.ts` | `startSync(remote, ownerId)` schedules passes; `getSyncStatus` / `onSyncStatus` |
| `supabaseRemote.ts` | `RemoteStore` over the Supabase tables, with realtime on `characters` |
| `useCloudSync.ts` | App hook: runs sync while the device is linked (`src/cloud`) and that account is the active player |
| `memoryRemote.ts` | In-memory `RemoteStore` with server rules, for tests and trying sync without a server |
| `duplicates.ts` | Same character twice: `findDuplicates` (same owner + name), `mergeSameBuilds`, `keepCopy`, `keepBoth` |
| `DuplicatePrompt.tsx` | Character list card that asks which copy to keep |
| `SyncBadge.tsx`, `sync.css` | "Saved to cloud / Offline / N changes waiting" chip |
| `packs.test.ts` | Packs across devices, to the party DM, privacy outside the party, deletes, conflicts, missing table |
| `npcs.test.ts` | NPC sheets across the DM's devices, never to another account, play state, deletes, conflicts, missing table |
| `sync.test.ts` | Two-device tests: first upload, new device, offline, conflicts, deletes, same character twice |
| `../../supabase/migrations/20261027100000_sync.sql` | `snapshots` and `rolls` tables and their access rules (checks in `supabase/tests/rls_test.sql`) |
| `../../supabase/migrations/20261030120000_homebrew_packs.sql` | `homebrew_packs` table: owner writes, owner + party members + admin read |
| `../../supabase/migrations/20261030210000_npc_sheets.sql` | `npc_sheets` table (from the hide-NPC-sheets work): owner or admin only, deletes are tombstones |

## How it works

- `storage.saveCharacter` / `deleteCharacter` and the snapshot store mark changes in the outbox. Sync writes back through `applyRemoteCharacter`, `removeRemoteCharacter` and `applyRemoteSnapshots`, which don't mark anything.
- Only characters whose `ownerId` is the signed-in account sync. Local profiles ("use this device only") never leave the device.
- First pass for an account on a device queues every character, snapshot and roll it already has: the one-time upload.
- A pass: push dirty characters (conditional on the revision last seen), pull rows changed since the cursor, then snapshots, then rolls.
- `startSync` runs a pass on start, 1.5 s after a local change, on `online`, when the app becomes visible, when another device writes (realtime) and every 30 s.
- Sync starts only after `activate(code)` has linked the device (`getCloudAccountId()`), and only for that account. Without cloud settings nothing runs and the badge stays hidden.
- Errors leave the outbox as it is; a network error shows Offline, anything else Sync failed.

## Conflicts

A push is refused when another device wrote the character since this one last synced. Then:

- An edit beats a delete, on either side.
- Otherwise the copy saved last (`updatedAt`) is kept everywhere.
- If the other copy's build differs (`BUILD_FIELDS`: level, classes, scores, feats...), it is kept as a snapshot labelled `CONFLICT_LABEL`, so Level history can roll back to it. Play state from the older copy (HP, slots) is dropped.

Snapshots and rolls never conflict: snapshots are written once (deletes sync as tombstones) and rolls are merged by id, newest 100 kept. Clearing roll history only clears this device until the next pull.

## NPC sheets

`src/npc/store.ts` marks saves and deletes (`markNpcDirty`); sync writes back through `applyRemoteNpc`, which doesn't. Rows are keyed by owner and sheet id in `npc_sheets`, pulled by `owner_id` only (the server's policies allow the owner and the admin, nobody else), pushed as upserts; a delete is a tombstone row. Conflicts: an edit beats a delete, otherwise the sheet with the later `updatedAt` wins. The first pass for an account queues every sheet already on the device (`npcsInitialized`). While the live database has no `npc_sheets` table yet, the remote throws `MissingTableError` and the pass skips NPCs, leaving them queued.

## Homebrew packs

Packs belong to the device's library (`src/homebrew/store.ts`), not one profile, so the linked account uploads every pack on the device, friends' read-only copies included. `savePack`, `importPack` and `deletePack` mark the pack in the outbox (`markPackDirty`); sync writes back through `applyRemotePack` (own) and `applyPartyPacks` (party), which don't. The first pass for an account queues every pack once (`packsInitialized`, separate from `initialized` so devices synced before packs existed upload theirs too).

- Rows are keyed by owner and pack id: a friend's pack in my library is my copy of it.
- One pull reads my rows and those of everyone I share a party with (the server's rule, `shares_party`). Party rows go to `ff.homebrew.shared.v1`; the rules engine sees my library plus the newest party copy of any pack not in it. So the DM's device resolves a player's homebrew subclass, class, race, items and feats without importing anything. The Homebrew screen lists them under "From your party" with Add to my library.
- Conflicts: an edit beats a delete; otherwise the pack's `updatedAt` decides. Deletes are tombstones (`deleted`), rows are never removed.
- While the live database has no `homebrew_packs` table yet, the remote throws `MissingTableError` and the pass skips packs, leaving them queued.
- Not handled: a member who leaves the party keeps their packs on the others' devices until they delete them.

## Same character twice

Characters are matched by id, so a hero built separately on two devices before signing in on both becomes two cloud copies (Ziv's David Jones, 2026-10-28). After each sync pass, the signed-in account's characters with the same name (trimmed, any case) are a duplicate group:

- Same build (`BUILD_FIELDS`): the newest copy is kept without asking (ties go to the lower id, so every device picks the same one).
- Different builds: `DuplicatePrompt` shows each copy (classes and subclass, race, background, last change) with Keep copy N, or Keep both (remembered on that device in `ff.duplicates.v1`).

Keeping a copy saves every other copy, whole (build, gear, play state), as a `MERGE_LABEL` snapshot on the kept one, moves their level history over, then deletes them through `deleteCharacter`, so the delete syncs to every device. Local profiles are never checked.

## Server

`characters` is in the foundation migration (`src/cloud/CLOUD.md`); `snapshots` and `rolls` are in `20261027100000_sync.sql`; `homebrew_packs` in `20261030120000_homebrew_packs.sql`. Owner or admin only; the DM sees none of it. `updated_at` is the server's clock and the pull cursor; pulls re-read 10 s before it, because a slow transaction can commit with an earlier time. Rolls are insert-only and keyed by roll id.

Portraits travel inside the character's `data`, so large images make every save bigger.
