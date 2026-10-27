# Cloud sync

Characters (with their play state, inventory and coins), level snapshots and roll history save to the server and load on any device the player signs in on with their activation code. Works offline: everything is saved on the device first and uploaded when the connection is back.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `RemoteStore` (what a backend implements), `RemoteRow`, `PushResult`, `SyncStatus` |
| `outbox.ts` | Bookkeeping in `ff.sync.v1`: server revision per character, unsent changes, pull cursors per account |
| `engine.ts` | `syncOnce(remote, ownerId)`: first upload, push, pull, conflicts; `resolveConflict`, `mergeRolls` |
| `runner.ts` | `startSync(remote, ownerId)` schedules passes; `getSyncStatus` / `onSyncStatus` |
| `memoryRemote.ts` | In-memory `RemoteStore` with server rules, for tests and trying sync without a server |
| `SyncBadge.tsx`, `sync.css` | "Saved to cloud / Offline / N changes waiting" chip |
| `sync.test.ts` | Two-device tests: first upload, new device, offline, conflicts, deletes |

## How it works

- `storage.saveCharacter` / `deleteCharacter` and the snapshot store mark changes in the outbox. Sync writes back through `applyRemoteCharacter`, `removeRemoteCharacter` and `applyRemoteSnapshots`, which don't mark anything.
- Only characters whose `ownerId` is the signed-in account sync. Local profiles ("use this device only") never leave the device.
- First pass for an account on a device queues every character, snapshot and roll it already has: the one-time upload.
- A pass: push dirty characters (conditional on the revision last seen), pull rows changed since the cursor, then snapshots, then rolls.
- `startSync` runs a pass on start, 1.5 s after a local change, on `online`, when the app becomes visible and every 30 s.
- Errors leave the outbox as it is; a network error shows Offline, anything else Sync failed.

## Conflicts

A push is refused when another device wrote the character since this one last synced. Then:

- An edit beats a delete, on either side.
- Otherwise the copy saved last (`updatedAt`) is kept everywhere.
- If the other copy's build differs (`BUILD_FIELDS`: level, classes, scores, feats...), it is kept as a snapshot labelled `CONFLICT_LABEL`, so Level history can roll back to it. Play state from the older copy (HP, slots) is dropped.

Snapshots and rolls never conflict: snapshots are written once (deletes sync as tombstones) and rolls are merged by id, newest 100 kept. Clearing roll history only clears this device until the next pull.

## Server contract

`RemoteStore` expects three owner-scoped tables: characters `(id, owner_id, data jsonb, rev, deleted, updated_at)` with conditional writes on `rev`; snapshots with the same columns; rolls `(id, owner_id, character_id, data, created_at)`. `updated_at` is the server's clock, used as the pull cursor.
