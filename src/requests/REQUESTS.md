# Requests to the DM

A player asks the DM for something new for their character: an item, an effect, an ability, anything. The DM grants it now, approves it for later in the story (it then shows as a reminder on the DM screen), or denies it. Granted requests are added to the character automatically.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `DmRequest` (saved shape), `RequestKind`, `RequestStatus` |
| `logic.ts` | Pure: `newRequest`, `problems`, `mechanics`, `decide`, `inbox` / `reminders` / `answered` / `mine`, `grantToCharacter`, link encode/decode (`linkFor`, `codeFrom`, `decodeShared`), `mergeShared` |
| `store.ts` | Async list per device (localStorage `ff.requests.v1`), `updateRequests`, `onRequestsChanged` (also other tabs) |
| `grants.ts` | `applyGrants(userId)`: adds granted, not yet applied requests to that player's characters, once |
| `hooks.ts` | `useRequests()` live list |
| `Requests.tsx` | `RequestsView` (player "Ask the DM" page), `DmRequestsTab`, `StoryReminders`, `RequestsAgent` (opens links, applies grants, shows a notice) |
| `requests.css` | Styles; both pages sit inside `.ff-sheet` |
| `requests.test.ts` | Validation, sorting, granting, links and merging |

## How it works

- **Player.** The "Ask the DM" chip (every account except the DM account). Name, description, kind, and optional mechanics: a dice roll (attack or save, ability, dice like `1d8+STR`, damage type), extra damage on attacks, and stat changes (the inventory's `EffectsEditor`).
- **DM.** The DM screen has a Requests tab (badge = new requests) and a "Story reminders" card under the top card with every request approved for later; each opens to show details and the DM's private story idea, with "Grant now".
- **Granting.** `grantToCharacter`: an item goes in the inventory (stat changes as `effects`, extra damage as `extraDamage`; its roll also becomes a combat-page action). An effect or ability becomes a custom action (`kind: 'other'`) with roll, extra damage and stats, switched on under Effects. "Something else" goes to the notes unless it has mechanics.
- **Between devices (no backend).** Each side shares a link `#ff-request=<code>` (phone share sheet, else clipboard). Opening it merges the request or answer into that device's list and opens the right page. Links that open in another browser can be pasted in the box under each list. Same-device play needs no links.
- **Privacy.** Answer links never carry the DM's story note. Codes are size-limited and every field is checked on decode.
- An answer replaces the status only if it isn't older than the one already here. A grant is applied once (`applied`), on the device that has the character.

## Known tasks

- **Backend later:** keep `store.ts`'s API and drop the links; requests would be addressed to the party's DM.
