# Admin

A page for the group's admin account (Ziv, `acct-ziv`) to see and manage everyone's data: live from Supabase when this device is signed in to the server, otherwise what is saved on this device.

## Files Covered

| File | Purpose |
|------|---------|
| `logic.ts` | Pure: `describeKey`, `keyRows`, `buildBackup` / `parseBackup` / `restorePlan`, `people` (roster + profiles + character counts), `cloudPeople` (server accounts + devices + characters + DM screen), `deviceOnly` |
| `cloud.ts` | Server side: `loadCloud`, `watchCloud` (realtime), `moveCloudCharacter`, `deleteCloudCharacter` (tombstone), `deleteCloudDm`, `unlinkCloudDevice` |
| `store.ts` | Raw localStorage access for `ff.*` keys: `readDevice`, `removeKey`, `restoreDevice` |
| `AdminPage.tsx` | Tabs: People (open the app as anyone; on the server also devices and Sign out), Characters (open, edit, move owner, delete), DM requests (change status, delete), DM screens (server only), Device data (every key, backup, restore, delete) |
| `admin.css` | Styles, scoped to `.ff-admin` |
| `admin.test.ts` | Admin lookup, key naming, backup round trip, restore plan, people list |

## How it works

- Admin is `admin: true` on a `ROSTER` entry; `isAdmin(session.id)` checks it by id, so devices signed in earlier get it too. It is separate from `role`, so the admin can still be a player.
- The admin gets an "Admin" chip in the top bar and the DM screen chip, whichever profile is open (`App.tsx`).
- "Open as" switches the active profile, creating it for a roster account that has none on this device.
- Restore replaces every `ff.*` key except `ff.account.v1`, then reloads.

## Server

- `getCloudStatus() === 'linked'` switches People and Characters to the server and adds DM screens. The access rules let only the admin read everyone (`is_admin()` in `supabase/migrations`), so no extra checks are needed here.
- `watchCloud` reloads on any change to `characters` or `dm_state`. Requests come from src/requests, which owns its own sync.
- Character writes are conditional on `rev`; a failed one shows `admin.serverFailed` and reloads. Delete sets `deleted` so devices drop it on their next sync.
- Open sheet / Edit copy the server's character to this device first when it is newer, because the sheet reads the device store.
- Characters on this device that the server lacks are listed under "Only on this device".
- Backups never include `ff.supabase.auth`; restore keeps it and `ff.cloud.v1`, so the admin stays signed in.

## Limits

Without the server (cloud off, not signed in, or offline) the page sees only this browser's data, and friends' data reaches it as a backup file or a character Export.
