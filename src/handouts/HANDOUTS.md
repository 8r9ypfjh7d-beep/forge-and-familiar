# Hand-outs

The DM of a party writes notes, uploads pictures and maps, and sends them to the whole party or to chosen players. Shown inside a party's view, under the member cards.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Handout`, `HandoutKind` (saved shape) |
| `logic.ts` | Pure rules: `canSee`, `visibleHandouts`, `isUnread`, `unreadCount`, `recipients`, `send`, `unsend`, `markSeen`, `problems` |
| `image.ts` | Downscales uploads to JPEG data URLs (pictures 1280px, maps 2048px on the long side) |
| `store.ts` | Async hand-out store (localStorage key `ff.handouts.v1`, also the offline copy of cloud parties' hand-outs), `refreshHandouts`, `onHandoutsChanged`, `HandoutSpaceError` |
| `cloud.ts` | Supabase rows (`handouts`, `handout_seen`), pull, save, read receipts, `watchHandouts` |
| `Handouts.tsx` | `Handouts` section (composer, cards, viewer with map zoom/pan) and `HandoutBadge` |
| `handouts.css` | Styles scoped to `.ff-handouts` and `.ff-handout-viewer` |
| `handouts.test.ts` | Visibility, receipts, validation, sizing tests |

## How it works

- Only the party's current DM (`party.dmId`) can create, edit, send, take back, or delete. A new DM inherits every hand-out.
- Unsent hand-outs are drafts only the DM sees, for preparing before a session. "Take back" turns a sent one into a draft and clears read receipts.
- `to: 'all'` includes players who join later; a list of ids reaches only those players while they stay in the party.
- Players see "New" until they open one; the DM sees "seen by N of M" per hand-out. The party list shows a "N new hand-outs" badge.
- Saving prunes hand-outs whose party no longer exists, so their images stop using storage.

## Across devices

For a cloud party (`cloudForParty` in src/party/store.ts) the DM's hand-outs go to Supabase and players get them live on their own phones; read receipts are rows per player. The server applies the same rule as `canSee`: the party's DM sees all, a member only sent hand-outs addressed to them (`20261028090000_party_shared.sql`). Images still travel as data URLs inside the row and are copied to this device for offline viewing. Local parties work as before.

## Limits

Images live in localStorage (about 5 MB per browser, shared with characters), so a full device throws `HandoutSpaceError` and the composer asks to delete old ones. With a backend, images belong in file storage and `canSee` runs server-side.
