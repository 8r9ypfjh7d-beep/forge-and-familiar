# Admin

A page for the group's admin account (Ziv, `acct-ziv`) to see and manage everything saved on the device.

## Files Covered

| File | Purpose |
|------|---------|
| `logic.ts` | Pure: `describeKey`, `keyRows`, `buildBackup` / `parseBackup` / `restorePlan`, `people` (roster + profiles + character counts) |
| `store.ts` | Raw localStorage access for `ff.*` keys: `readDevice`, `removeKey`, `restoreDevice` |
| `AdminPage.tsx` | Tabs: People (open the app as anyone), Characters (open, edit, move owner, delete), DM requests (change status, delete), Device data (every key, backup, restore, delete) |
| `admin.css` | Styles, scoped to `.ff-admin` |
| `admin.test.ts` | Admin lookup, key naming, backup round trip, restore plan, people list |

## How it works

- Admin is `admin: true` on a `ROSTER` entry; `isAdmin(session.id)` checks it by id, so devices signed in earlier get it too. It is separate from `role`, so the admin can still be a player.
- The admin gets an "Admin" chip in the top bar and the DM screen chip, whichever profile is open (`App.tsx`).
- "Open as" switches the active profile, creating it for a roster account that has none on this device.
- Restore replaces every `ff.*` key except `ff.account.v1`, then reloads.

## Limits

No backend: the page sees only this browser's data. Friends' data reaches it as a backup file (Download backup on their device) or a character Export. With a backend later, swap `store.ts` and the storage calls for server queries.
