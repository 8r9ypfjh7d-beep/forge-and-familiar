# Party

Join a party with an invite code and see everyone's character at a glance. First step toward the DM dashboard.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Party`, `PartyMember` (saved shape) |
| `code.ts` | Invite codes and pure membership updates (`addMember`, `removeMember`, `setMemberCharacter`) |
| `store.ts` | Async party store: cloud parties for the signed-in account, localStorage for local profiles; `onPartiesChanged` |
| `cloud.ts` | Supabase side: fetch and cache (`ff.parties.cloud.v1`), realtime, members' characters and rolls, `sendRoll` |
| `xp.ts` | Pure: DM XP awards (`awardsFor`, `addAward`, `takeAwards`); a milestone lifts XP to the next level |
| `GiveXp.tsx` | DM-only "Give XP" card on the party page: tick players, give XP or a milestone level |
| `useXpAwards.ts` | App hook: adds awards to the characters this player brought, on their device, once (`Character.appliedAwards`) |
| `xp.test.ts` | Award tests |
| `stash.ts` | Shared inventory and gold: pure `applyStash(party, userId, action)`, coin maths, even split |
| `PartyView.tsx` | Party list first, then one "New party" button that opens a panel to start (name + DM) or join with a code; read-only party table |
| `active.ts` | The party in play: remembered pick per player (`ff.activeParty.v1.<id>`), `isPartyDm`, `canWatchSheets` (DM/admin open every member's sheet), `campaignTarget` (where tapping a campaign leads) |
| `useActiveParty.ts` | Hook for App: the player's parties, the one in play, whether to ask, whether they're its DM |
| `CampaignsHome.tsx` | The app's first screen (Home tab): your campaigns, tap one to play it; empty state offers sign-in, join, start, build. `CampaignManage`: End / Leave buttons, also on the party page; `EndedCampaigns`: Bring back / Delete forever / Remove |
| `PartySwitcher.tsx` | The Campaign switch in the player menu |
| `feed.ts` | Party roll feed: merges members' dice histories (`mergePartyRolls`), live via `onMemberRollsChanged` |
| `RollFeed.tsx` | "Party rolls" panel under the party table; `PartyRollRelay` (in App) sends each sheet roll to the cloud at once |
| `PartyStash.tsx` | Stash panel under the party table: coins, items, change log. The Codex (src/lore, LORE.md) sits under it |
| `party.css` | Styles scoped to `.ff-party`, Liquid Glass (`src/design/DESIGN.md`): `.glass` cards, `.glass-btn`, `.glass-field`; secret rolls, polls and hand-outs on the page use the same utilities |
| `visibility.ts` | Pure: `canViewCharacter(character, { userId, parties })` (owner, admin, or brought to a shared party; mirrors the server's rules), `broughtToSharedParty`, `isDmOf` |
| `useCharacterAccess.ts` | App hook: a character screen for a character this profile may not see bounces home |
| `party.test.ts` | Code and membership tests |
| `active.test.ts` | Party in play and per-party DM |
| `feed.test.ts` | Roll feed merge and filter tests |
| `stash.test.ts` | Stash actions, coin conversion and splitting |
| `cloud.test.ts` | Create/join on the server, local profiles stay local, stash write races |
| `../../supabase/migrations/20261027120000_parties.sql` | `parties`, `party_members`, RPCs, access rules, realtime |

## How it works

- Creating a party means choosing its DM: the creator or any other player. Creator and DM join; the DM usually watches without a character. Players join with a code and pick which character they bring; anyone can switch or watch only.
- Joining a code you are already in just opens the campaign. If this device is not signed in to the cloud as the joining player (another account or "this device only"), the join says so and shows the activation-code form instead of "no such code"; signing in there retries the join.
- Every visit opens on the campaigns home (`CampaignsHome`, the Home tab): every campaign the player is in, their role, the DM and the character they bring. Tapping one makes it the party in play and opens it: its DM gets the DM screen, a player the sheet they bring, or the party page to pick a character when they bring none (or it isn't on this device). With no campaign: the sync sign-in (campaigns live on the server), join with a code, start one, build a character.
- The DM role is per party. The party in play's DM gets the DM pages (DM screen, Combat, Party tabs); everyone else gets the player pages. A single party is in play without asking; the Campaign switch in the player menu changes it, and "Play without a party" gives the player pages.
- Garden Gang (`party-garden-gang`, code GAR-DEN) is seeded by `20261028100000_party_dm.sql` with every friend and Noa as DM.
- Codes: 6 chars from `CODE_ALPHABET` (no 0/O/1/I/L), shown as `ABC-234`, typed loosely (case, spaces, dash ignored).
- If the DM leaves, the longest-standing member becomes DM; the last member leaving deletes the party.
- End campaign (`endParty`, server `end_party`): its DM or the admin (`canEndParty`) ends it for everyone. Since `20261101120000_restore_party.sql` ending only sets `parties.ended_at` (device campaigns: `Party.endedAt`); members, stash, lore, maps, polls and rolls all stay. `listParties` returns running campaigns only (`runningParties` in active.ts), so an ended one leaves every list, pick and the party page; `listEndedParties` feeds the folded "Ended campaigns" section at the bottom of Home (`EndedCampaigns` in CampaignsHome.tsx). There its DM or the admin (`canRestoreParty`) taps Bring back (`restoreParty` / `restore_party`: same members and invite code) or Delete forever (`deleteParty` / `delete_party`, only for an ended campaign, typed-name confirm listing what is lost); other members get Remove from my list (`leaveParty`). While ended, nobody new can join by code (`join_party` raises 'campaign ended', JoinResult reason `ended`) and members stop seeing each other's characters and rolls (`sees_party_character`/`sees_party_roll`). End is a yes/no `ConfirmDialog` saying it can come back; `canUndoEnd` falls back to the old typed-name warning when the server lacks the migration (the party fetch got Postgres 42703 on `ended_at`, cached as `restorable: false`), because the old `end_party` deletes. Characters are separate rows and never touched.
- The table is read-only: HP bar with temp HP and dying/stable/dead, AC, initiative, speed, passive Perception, spell DC, conditions. Stats come from `derive()`; nothing derived is stored on the party.
- Opening sheets: a player opens only their own ("Open my sheet"). The campaign's DM and the admin (`canWatchSheets`) get "Open <player>'s sheet" on every member card, which opens `src/sheet/WatchSheet.tsx` (`#/watch/<id>`): the full sheet, view only, live from the cloud. The DM screen lists the same characters under "Party sheets".
- Party rolls: the 50 newest rolls across members, read from each player's own dice history (`ff.rolls.v1.<userId>`), nothing copied. A roll shows when it is tagged with the character that member brings and made after they joined. Watchers' rolls (the DM's) never show, and secret rolls never enter that history. Free rolls from the Dice tab carry no character, so only sheet rolls appear.
- Secret rolls: below the table, players roll a skill, check or save that only the DM sees; the DM gets the log. Lives in `src/dice` (`secret.ts`, `ui/SecretRolls.tsx`).
- Updates live via `onPartiesChanged` and `onCharactersChanged`, including other tabs.

## Shared stash

- XP awards ride in the stash (`stash.awards`, newest 50; the `award` action): only the party's DM gives them, each names the player and the character they bring at that moment, and the log says "gave 300 XP to Vex". No server change was needed: the stash is the one shared jsonb members may write.

- `Party.stash` is optional (`getStash()` fills in an empty one), so older saved parties keep working.
- Every member can change it through `updateStash(partyId, userId, action)`; each change is logged as "who did what", newest first, capped at 50.
- The log is stored as English text. `parseStashLog(text)` reads it back into parts so `PartyStash` shows it in the current language (keys `stash.*`); a new log line in `applyStash` needs a matching case there. Failure reasons are mapped to `stash.err.*` keys the same way. Typed item names and reasons stay as written.
- Coins use all five SRD coins (pp, gp, ep, sp, cp). Taking more than the stash holds is refused.
- Split hands each member who brings a character an equal share in gp/sp/cp; the copper that doesn't divide evenly stays. Shares are logged, not paid into character sheets: the sheet owns character coins.
- Items picked by SRD name get an `itemId`. The same item stacks in the bag unless either one has a note. A member can carry an item (`heldBy`) or put it back.

## Across devices (Supabase)

- When the open player is the account this device is signed in to (`getCloudAccountId()`), parties live on the server: create, join by code, switch character, leave and the stash all go there, and every member's screen updates live (realtime on `parties` and `party_members`). The last list is cached, so it still shows offline; changes need a connection.
- Local profiles ("use this device only") and builds without the cloud keep parties in `ff.parties.v1`, same-device only, as before. Parties made on a device before the cloud stay local.
- Server rules: only members read a party (codes can't be listed); creating, joining, leaving, ending, restoring and deleting go through `create_party`, `join_party`, `leave_party`, `end_party`, `restore_party`, `delete_party` (DM hand-off and deleting the empty party happen there); join times are the server's clock. Members may change the stash (`stash`, `rev` columns only) and their own character.
- Stash writes are conditional on `rev`; if someone else wrote first, the change is re-applied to the fresh stash (up to 4 tries).
- Who sees a sheet is one rule on both sides: `canViewCharacter` in `visibility.ts` on the device, `characters_read` + `characters_party_read` on the server. NPC sheets (src/npc) are not characters: they live in `npc_sheets`, owner-only, and players meet NPCs only through what the DM shows them (`playerView` in src/combat).
- Members read the character each other member brings (`characters_party_read`) and its rolls made since joining (`rolls_party_read`); the party table fetches the ones not on this device and watches them live. Player names come from `accounts` when the profile isn't on the device.
- A party's DM answers requests from that party's members (`can_answer_request`); the account-wide `dm` role no longer does (`20261028100000_party_dm.sql`).
- Invite codes: 10 wrong codes per account in 15 minutes, then `join_party` refuses ("too many tries").
- Secret rolls, hand-outs and session polls of a cloud party also go through Supabase (`20261028090000_party_shared.sql`, see their own docs); `cloudForParty(partyId)` in `store.ts` tells those modules whether a party is a cloud one.
