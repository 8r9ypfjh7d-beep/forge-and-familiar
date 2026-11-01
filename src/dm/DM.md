# DM screen

The Dungeon Master's own page: plan fights against the party's XP budget, look up and roll monsters from every source (SRD, official books, homebrew), a quick-rules screen, and an NPC list with a generator. It reads only the levels of the characters in the campaign being run: the budget starts from them ("Fill from <campaign>" resets it), and the DM can still edit the groups.

## Files Covered

| File | Purpose |
|------|---------|
| `edition.ts` | `readDmEdition` / `writeDmEdition`: the rules edition the monster screens show, per device |
| `types.ts` | `DmState` (party groups, encounter plans, NPCs), `emptyDmState` |
| `logic.ts` | Pure: `XP_BUDGET` (SRD 5.2), `partyBudget`, `groupsFromLevels`/`sameGroups` (budget from the campaign's characters), `difficulty`, plan edits, `planCombatants` (tracker hand-off), `findMonsters` (English or translated name, CR, type, source group; summon/companion stat blocks only when searched by name or under the "summon" type), `typeGroups`/`monsterTypes` (swarms under their base type, "X or Y" split; labels `dm.ctype.*`), `monsterGroups`, NPC generator with an injected picker, `normalizeDm` |
| `dmTools.ts` | `useDmTools`: the DM pages without a campaign in play. On for good (`ff.dmTools.v1.<userId>`) once the profile DMs a campaign, has DM data (`hasDmData`: plans or NPC ideas), or taps "I'm a DM" on Home. App then allows the DM screen and tracker (under More); party-only tabs show their empty state. It never grants the DM's role in someone else's campaign (free edits, watching sheets stay with `partyDm`/admin) |
| `store.ts` | `loadDm` / `syncDm` / `saveDm` / `onDmChanged`: device cache `ff.dm.v1.<userId>` synced with Supabase `dm_state` |
| `DmScreen.tsx` | Top card (party and budget tiles; folded to one line by default, open state per device in `ff.dm.topOpen.v1`), story reminders (src/requests), and tabs: Encounters, Lore (src/lore Codex; offers to open or start a campaign when none the DM runs is in play), Rolls, Monsters (stat block from src/monsters), Maps (src/maps `MapsTab`), Quick rules, NPCs, Requests |
| `rolls.ts` | Pure: `mergeDmRolls` (players' public and secret rolls in one newest-first log), `filterRolls` (player, kind), `playerSummary` (count, last roll, natural 20s and 1s), `unseenCount` for the tab badge |
| `RollsTab.tsx` | Rolls tab: player chips, kind filter, live log grouped by action, Clear secret rolls |
| `useDmRolls.ts` | `useDmRolls` keeps the log live (own history, other tabs, Supabase realtime on `rolls` and `secret_rolls`), `useUnseenRolls` counts rolls since the DM last opened the tab |
| `dm.css` | Liquid Glass styles (src/design/DESIGN.md), scoped to `.ff-sheet.ff-dm`: the page keeps the sheet's layout helpers but its cards, tabs, buttons, fields and the request cards on it use the `--glass-*` tokens |
| `dm.test.ts` | Budget, difficulty, plans, hand-off, search and generator tests; dm.css uses logical properties and glass tokens |
| `rolls.test.ts` | Roll log merge, filters, player summary, badge count |

## How it works

- **Who sees it.** The DM screen and the combat tracker are for the DM account (`getSession()?.role === 'dm'`, see src/accounts) and the admin account only; players can neither see the tabs nor open the views (`canOpen` in src/nav). The DM account lands on it after sign-in.
- **Budget.** SRD 5.2 "XP Budget per Character" summed per level group. Difficulty is the plan's total monster XP against Low / Moderate / High (no multiplier for numbers, as in SRD 5.2). Nothing derived is saved.
- **Monsters.** `loadMonsters(edition)` from src/content: the SRD, the official book monsters, older-book monsters shown as legacy for 2024, and homebrew packs (reloaded on `onContentChanged`). A 2014/2024 toggle on the tab is remembered on the device (`ff.dm.edition.v1`); campaigns do not carry an edition. Filters: name in English or Hebrew, CR, type and source (SRD, each book, homebrew). The open stat block and list rows are keyed by `monsterKey` (`source:id`) because the same id exists in both editions. Names show in Hebrew with the English under them; book monsters show their Hebrew summaries and the source line under the block, and the page footer lists the attribution of every source shown. The stat block is the shared `StatBlock` (src/monsters, see MONSTERS.md); `crLabel` and `abilityMod` in `logic.ts` come from src/monsters. Stat block bonuses, saves, skills, attacks and damage roll through `useDice`, so they land in the DM's own history. The party roll feed never shows the DM's rolls (watchers are skipped).
- **Scenarios.** A plan has DM notes (read-aloud text, tactics), "Roll hit points" and, later, a battle map (`mapId`) and NPC sheets: "+ NPC sheet" adds one of the DM's NPC sheets for the campaign (`npcPlanEntry`, `PlanMonster.npcId`, source `npc`, always one), its name opens the sheet, and Start puts it in the fight as itself (its own block and current HP). The meter reads "Moderate for 4 players".
- **Start fight.** `planCombatants` makes one `npc` row per creature carrying its stat block reference (`monster: { source, id }`), average or rolled HP, first AC, CON save, and initiative rolled once per group through the DM's dice; then `campaignRows` (src/combat) adds every character the campaign's members bring, and the fight opens in src/combat.
- **Quick rules.** DCs, cover, travel pace, light, conditions, and a few rulings, as translated text (keys `dm.ref.*`, `dm.cond.*`). Exhaustion is left out on purpose (removed from the app).
- **Rolls.** Every player's rolls in one place, so the DM never has to leave the screen: the public rolls the party feed shows (the character each member brings, since they joined; `src/party/feed.ts` rules) plus the party's secret rolls (`src/dice/secret.ts`, `secret_rolls`, readable only by the DM), newest first, attack and damage of one action as one card. Chips per player show their count, last roll and natural 20s/1s and filter the log; a segmented control narrows to attacks, checks, saves or secret rolls. The tab shows a badge with the rolls that landed since the DM last opened it (`ff.dm.rollsSeen.v1.<userId>`). Live through this device's history, other tabs (`storage` events) and Supabase realtime on `rolls` and `secret_rolls`. Without a campaign in play the tab says to open one from Home. The DM's own rolls never appear (the DM brings no character).
- **Maps.** The Maps tab is `MapsTab` from src/maps (see MAPS.md): the DM's battle maps, saved per account in `dm_maps`. Each plan picks an optional map (`MapPicker`, saved as `EncounterPlan.mapId`); Start puts it on the new encounter as `board` (map id, the map's starting fog, no tokens yet) for the tracker to place tokens on.
- **Player requests.** Story reminders card and the Requests tab come from src/requests (see REQUESTS.md).
- **NPCs.** Generator picks a made-up name plus a translated role, quirk and want (`dm.npc.*`, sizes in `NPC_TABLES`). Kept NPCs are editable text. NPCs with a stat block and play state are `NpcSheet`s (src/npc, NPC.md); their creator and sheet screen hang off this tab: "+ New NPC" lists the sheets and opens the creator, "Give stats" turns a text NPC into a sheet, and the Monsters tab's "Make an NPC" starts one from the open stat block. `edition.ts` keeps the 2014/2024 choice the Monsters tab and the creator share.

- **Sync.** When the device is signed in to the server as that account (or as the admin), `store.ts` keeps the `dm_state` row in step: `loadDm` returns the device copy at once, `syncDm` reconciles (`pickDm`: unsent edits on this device win, else the server copy), `saveDm` writes locally and pushes after a short pause, `onDmChanged` applies other devices' saves live. `ff.dm.pending.v1.<userId>` marks unsent edits, so offline changes go up on the next save or open.

## Known tasks

- **Restyle something on the page:** use the `--glass-*` tokens in `dm.css` under `.ff-sheet.ff-dm` (raises specificity over sheet.css and requests.css); glass cards are regular, cards with paragraphs thick, tiles inside a card thin without blur.

- **Add a reference panel:** add its keys to both locales and a `RefCard` in `ReferenceTab`.
- **Grow the NPC tables:** add `dm.npc.<table>.<n>` keys in both locales and raise `NPC_TABLES`; the test checks they match.
- **Change what syncs:** `store.ts` owns it. DM data is private to the DM (and the admin); the DM screen never reads players' characters.

## Party sheets (2026-10-30)

The top card lists the campaign's characters (`usePartyHeroes`, the DM's own watching seat left out) under "Party sheets"; each button opens that player's sheet view only (`onOpenSheet` → `#/watch/<id>`, `src/sheet/WatchSheet.tsx`). The same list feeds the XP budget levels. The DM screen still never changes a player's character.

Phones: the folded top card keeps the tabs on the first screen. Under 900px the Monsters tab stacks, so opening a monster scrolls its stat block into view and the block gets a "Back to list" button. Grid columns use `minmax(0, 1fr)` and the stat block and credits wrap long URLs, so nothing widens the page.

## Party level (2026-11-01)

Under the top card, `PartyLevelUp` (src/party) shows the campaign's levels and a one-tap "Give a level" (milestone award to the ticked players) or "Catch up to level N" for players behind the party's top level. It opens by itself while anyone is still levelling up and lists each player as sent / choosing / levelled up. Players get `LevelUpPrompt` on their device, which opens the existing Level Up screen. See src/party/PARTY.md.
