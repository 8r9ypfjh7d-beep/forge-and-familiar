# Requests to the DM

A player asks the DM for something new for their character: an item, an effect, an ability, anything. The DM grants it now, approves it for later in the story (it then shows as a reminder on the DM screen), or denies it. Granted requests are added to the character automatically.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `DmRequest` (saved shape), `RequestKind`, `RequestStatus` |
| `logic.ts` | Pure: `newRequest`, `newEditRequest`, `newLevelUpRequest` / `openLevelUpRequest` / `levelUpNeed`, `editState`, `spendEditPass`, `problems`, `mechanics`, `decide`, `inbox` / `reminders` / `answered` / `mine`, `grantToCharacter`, link encode/decode (`linkFor`, `codeFrom`, `decodeShared`), `mergeShared` |
| `store.ts` | Async list per device (localStorage `ff.requests.v1`), `updateRequests`, `onRequestsChanged` (also other tabs); notes each save for the cloud (`ff.requests.sync.v1`) |
| `sync.ts` | Pure: `toRow` / `fromRow` for the `dm_requests` table, `noteLocalChange`, `mergeRows` |
| `cloud.ts` | `startRequestsCloud()` (push, pull, realtime), `pushRequests`, `pullRequests`, `isDelivered` |
| `grants.ts` | `applyGrants(userId)`: adds granted, not yet applied requests to that player's characters, once |
| `hooks.ts` | `useRequests()` live list |
| `Requests.tsx` | `RequestsView` (player "Ask the DM" page), `DmRequestsTab`, `StoryReminders`, `RequestsAgent` (opens links, applies grants, shows a notice), `DmRequestPopup`, `EditRequestDialog` |
| `requests.css` | Styles; both pages sit inside `.ff-sheet`. The player page and its pop-ups (`.ff-requests`) follow the Liquid Glass standard (`src/design/DESIGN.md`); the DM tab keeps the shared rules |
| `requests.test.ts` | Validation, sorting, granting, links and merging; `requests.css` uses glass tokens and logical properties |
| `sync.test.ts` | Rows, merging pulls, push and pull against a fake table |
| `../../supabase/migrations/20261027110000_dm_requests.sql` | `dm_requests` table, guard trigger, access rules, realtime |

## How it works

- **Player.** The "Ask the DM" tab in the top bar (every account except the DM account; the DM screen tab shows a count of waiting requests). Name, description, kind, and optional mechanics: a dice roll (attack or save, ability, dice like `1d8+STR`, damage type), extra damage on attacks, stat changes (the inventory's `EffectsEditor`), and uses per rest (`uses`, like custom actions: a number or the proficiency bonus, refilled on a short or long rest, at dawn, or by hand).
- **DM.** The DM screen has a Requests tab (badge = new requests) and a "Story reminders" card under the top card with every request approved for later; each opens to show details and the DM's private story idea, with "Grant now".
- **Granting.** `grantToCharacter`: an item goes in the inventory (stat changes as `effects`, extra damage as `extraDamage`; its roll or uses also become a combat-page action with a counting Use button). An effect or ability becomes a custom action (`kind: 'other'`) with roll, extra damage and stats, switched on under Effects. "Something else" goes to the notes unless it has mechanics.
- **DM pop-up.** `DmRequestPopup` (mounted in App for the DM) pops up every new request once, on any page, to answer right there and send the answer link. "Not now" remembers it was seen (localStorage `ff.requests.popupSeen.v1`); it stays in the Requests tab.
- **Edit approval.** Players can't edit a character freely. Their Edit button reads "Ask to edit" and opens `EditRequestDialog`, which sends a request of kind `edit` (what they want to change). The DM allows or denies it. An allowed edit unlocks Edit for that character once (`editState` = `approved`); saving the edit spends it (`spendEditPass` sets `applied`). The DM (`role: 'dm'` or a party's DM) and the admin (`isAdmin` in accounts/roster.ts, Ziv) edit directly, and so does a player whose character has no DM (not in a party run by someone else). Level Up needs no OK once XP is enough; without it, it opens `EditRequestDialog` with `levelUp`, which sends a request of kind `levelup` carrying the character's `level` and `xp`. The DM's card (`LevelUpCard`) offers "Give N XP (level L)" (`levelUpNeed`) and "Milestone level": both are an XP award in the DM's campaign that has that character (party stash, src/party/xp.ts), so the XP lands on the sheet and Level Up opens; the request is then marked granted. Edit and level-up requests never go through `grantToCharacter`.
- **Live through the cloud.** `RequestsAgent` runs `startRequestsCloud()` when the device is signed in to the cloud (`getCloudAccountId()`). Every local save marks what changed; changes are sent to `dm_requests` (a player upserts their own requests, the DM only updates the answer), then the device pulls every row it may see. A realtime subscription pulls again on any change, so the DM's pop-up appears and the answer is applied on the player's device within a second. Offline, changes wait (`dirty`) and are sent on reconnect or when the app comes back to the front. A delivered request or answer shows "Sent to the DM" / "{name} gets this automatically" instead of the share button.
- **Server rules.** Players read and send only their own requests; DM accounts (`is_dm()`) and the admin read all and answer; a party's DM reads and answers requests about characters brought to that party (`20261027120000_parties.sql`). A guard trigger keeps each side to its part: new requests always start pending (nobody grants themselves), the DM can't change the request or `applied`, the player can't change the answer. A player can delete a request only while it waits ("Take back"); "Remove" on an answered request, and the DM's "Remove", only hide it on that device (`hidden`), so the other side keeps its copy. `can_answer_request()` is the one place to widen who answers (e.g. a party's DM).
- **Links (fallback).** Without the cloud (no sign-in, offline, or a request that never reached the server) each side shares a link `#ff-request=<code>` (phone share sheet, else clipboard). Opening it merges the request or answer into that device's list and opens the right page. Links that open in another browser can be pasted in the box under each list. On the first sync of an account, everything already on the device is sent, so requests from before the cloud catch up.
- **Privacy.** Neither answer links nor the server ever get the DM's story note. Codes are size-limited and every field is checked on decode.
- An answer replaces the status only if it isn't older than the one already here. A grant is applied once (`applied`), on the device that has the character.

## Known tasks

- **Who answers:** `can_answer_request()` (replaced in the parties migration) is the one place to change it.
