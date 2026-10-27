# Party

Join a party with an invite code and see everyone's character at a glance. First step toward the DM dashboard.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Party`, `PartyMember` (saved shape) |
| `code.ts` | Invite codes and pure membership updates (`addMember`, `removeMember`, `setMemberCharacter`) |
| `store.ts` | Async party store: cloud parties for the signed-in account, localStorage for local profiles; `onPartiesChanged` |
| `cloud.ts` | Supabase side: fetch and cache (`ff.parties.cloud.v1`), realtime, members' characters and rolls, `sendRoll` |
| `stash.ts` | Shared inventory and gold: pure `applyStash(party, userId, action)`, coin maths, even split |
| `PartyView.tsx` | Party list, create/join forms, read-only party table |
| `feed.ts` | Party roll feed: merges members' dice histories (`mergePartyRolls`), live via `onMemberRollsChanged` |
| `RollFeed.tsx` | "Party rolls" panel under the party table; `PartyRollRelay` (in App) sends each sheet roll to the cloud at once |
| `PartyStash.tsx` | Stash panel under the party table: coins, items, change log |
| `party.css` | Styles scoped to `.ff-party` |
| `party.test.ts` | Code and membership tests |
| `feed.test.ts` | Roll feed merge and filter tests |
| `stash.test.ts` | Stash actions, coin conversion and splitting |
| `cloud.test.ts` | Create/join on the server, local profiles stay local, stash write races |
| `../../supabase/migrations/20261027120000_parties.sql` | `parties`, `party_members`, RPCs, access rules, realtime |

## How it works

- Creator is the DM and joins without a character. Players join with a code and pick which character they bring; anyone can switch or watch only.
- Codes: 6 chars from `CODE_ALPHABET` (no 0/O/1/I/L), shown as `ABC-234`, typed loosely (case, spaces, dash ignored).
- If the DM leaves, the longest-standing member becomes DM; the last member leaving deletes the party.
- The table is read-only: HP bar with temp HP and dying/stable/dead, AC, initiative, speed, passive Perception, spell DC, conditions. Stats come from `derive()`; nothing derived is stored on the party.
- Party rolls: the 50 newest rolls across members, read from each player's own dice history (`ff.rolls.v1.<userId>`), nothing copied. A roll shows when it is tagged with the character that member brings and made after they joined. Watchers' rolls (the DM's) never show, and secret rolls never enter that history. Free rolls from the Dice tab carry no character, so only sheet rolls appear.
- Secret rolls: below the table, players roll a skill, check or save that only the DM sees; the DM gets the log. Lives in `src/dice` (`secret.ts`, `ui/SecretRolls.tsx`).
- Updates live via `onPartiesChanged` and `onCharactersChanged`, including other tabs.

## Shared stash

- `Party.stash` is optional (`getStash()` fills in an empty one), so older saved parties keep working.
- Every member can change it through `updateStash(partyId, userId, action)`; each change is logged as "who did what", newest first, capped at 50.
- Coins use all five SRD coins (pp, gp, ep, sp, cp). Taking more than the stash holds is refused.
- Split hands each member who brings a character an equal share in gp/sp/cp; the copper that doesn't divide evenly stays. Shares are logged, not paid into character sheets: the sheet owns character coins.
- Items picked by SRD name get an `itemId`. The same item stacks in the bag unless either one has a note. A member can carry an item (`heldBy`) or put it back.

## Across devices (Supabase)

- When the open player is the account this device is signed in to (`getCloudAccountId()`), parties live on the server: create, join by code, switch character, leave and the stash all go there, and every member's screen updates live (realtime on `parties` and `party_members`). The last list is cached, so it still shows offline; changes need a connection.
- Local profiles ("use this device only") and builds without the cloud keep parties in `ff.parties.v1`, same-device only, as before. Parties made on a device before the cloud stay local.
- Server rules: only members read a party (codes can't be listed); creating, joining and leaving go through `create_party`, `join_party`, `leave_party` (DM hand-off and deleting the empty party happen there); join times are the server's clock. Members may change the stash (`stash`, `rev` columns only) and their own character.
- Stash writes are conditional on `rev`; if someone else wrote first, the change is re-applied to the fresh stash (up to 4 tries).
- Members read the character each other member brings (`characters_party_read`) and its rolls made since joining (`rolls_party_read`); the party table fetches the ones not on this device and watches them live. Player names come from `accounts` when the profile isn't on the device.
- The party's DM answers requests about characters brought to that party (`can_answer_request`).
- Still same-device only: secret rolls, hand-outs and session polls.
