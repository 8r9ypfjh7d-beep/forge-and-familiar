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
| `PartyView.tsx` | Party list, create form (name + DM) and join form, read-only party table |
| `active.ts` | The party in play: remembered pick per player (`ff.activeParty.v1.<id>`), asked once per visit (`ff.partyPicked.v1.<id>` in sessionStorage), `isPartyDm` |
| `useActiveParty.ts` | Hook for App: the player's parties, the one in play, whether to ask, whether they're its DM |
| `PartyPicker.tsx` | "Which campaign are you playing?" screen on entering the app, and the Campaign switch in the player menu |
| `feed.ts` | Party roll feed: merges members' dice histories (`mergePartyRolls`), live via `onMemberRollsChanged` |
| `RollFeed.tsx` | "Party rolls" panel under the party table; `PartyRollRelay` (in App) sends each sheet roll to the cloud at once |
| `PartyStash.tsx` | Stash panel under the party table: coins, items, change log |
| `party.css` | Styles scoped to `.ff-party`, Liquid Glass (`src/design/DESIGN.md`): `.glass` cards, `.glass-btn`, `.glass-field`; secret rolls, polls and hand-outs on the page use the same utilities |
| `party.test.ts` | Code and membership tests |
| `active.test.ts` | Party in play and per-party DM |
| `feed.test.ts` | Roll feed merge and filter tests |
| `stash.test.ts` | Stash actions, coin conversion and splitting |
| `cloud.test.ts` | Create/join on the server, local profiles stay local, stash write races |
| `../../supabase/migrations/20261027120000_parties.sql` | `parties`, `party_members`, RPCs, access rules, realtime |

## How it works

- Creating a party means choosing its DM: the creator or any other player. Creator and DM join; the DM usually watches without a character. Players join with a code and pick which character they bring; anyone can switch or watch only.
- The DM role is per party. On entering the app a player in more than one party picks the one they play now (a single party is picked for them; "Play without a party" gives the player pages). That party's DM gets the DM pages (DM screen, Combat, Party tabs); everyone else gets the player pages. The Campaign switch in the player menu changes it. Making or joining a party mid-game doesn't pop the picker up.
- Garden Gang (`party-garden-gang`, code GAR-DEN) is seeded by `20261028100000_party_dm.sql` with every friend and Noa as DM.
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
- A party's DM answers requests from that party's members (`can_answer_request`); the account-wide `dm` role no longer does (`20261028100000_party_dm.sql`).
- Invite codes: 10 wrong codes per account in 15 minutes, then `join_party` refuses ("too many tries").
- Secret rolls, hand-outs and session polls of a cloud party also go through Supabase (`20261028090000_party_shared.sql`, see their own docs); `cloudForParty(partyId)` in `store.ts` tells those modules whether a party is a cloud one.
