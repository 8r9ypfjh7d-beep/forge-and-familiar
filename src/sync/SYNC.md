# Cloud sync

Characters (with their play state, inventory and coins), level snapshots and roll history save to the server and load on any device the player signs in on with their activation code. Works offline: everything is saved on the device first and uploaded when the connection is back.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `RemoteStore` (what a backend implements), `RemoteRow`, `PushResult`, `SyncStatus` |
| `outbox.ts` | Bookkeeping in `ff.sync.v1`: server revision per character, unsent changes, pull cursors per account |
| `engine.ts` | `syncOnce(remote, ownerId)`: first upload, push, pull, conflicts; `resolveConflict`, `mergeRolls` |
| `runner.ts` | `startSync(remote, ownerId)` schedules passes; `getSyncStatus` / `onSyncStatus` |
| `supabaseRemote.ts` | `RemoteStore` over the Supabase tables, with realtime on `characters` |
| `useCloudSync.ts` | App hook: runs sync while the device is linked (`src/cloud`) and that account is the active player |
| `memoryRemote.ts` | In-memory `RemoteStore` with server rules, for tests and trying sync without a server |
| `SyncBadge.tsx`, `sync.css` | "Saved to cloud / Offline / N changes waiting" chip |
| `sync.test.ts` | Two-device tests: first upload, new device, offline, conflicts, deletes |
| `../../supabase/migrations/20261027100000_sync.sql` | `snapshots` and `rolls` tables and their access rules (checks in `supabase/tests/rls_test.sql`) |

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

## Server

`characters` is in the foundation migration (`src/cloud/CLOUD.md`); `snapshots` and `rolls` are in `20261027100000_sync.sql`. Owner or admin only; the DM sees none of it. `updated_at` is the server's clock and the pull cursor; pulls re-read 10 s before it, because a slow transaction can commit with an earlier time. Rolls are insert-only and keyed by roll id.

Portraits travel inside the character's `data`, so large images make every save bigger.
