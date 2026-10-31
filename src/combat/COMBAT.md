# Combat tracker

Initiative order, turns and rounds, concentration saves, and spell or condition timers that end on their own.
Pure engine at the top level (no React, dice or storage); React in `ui/`. Opened from the **Combat** tab in the top bar, which only the DM and admin accounts get (see src/nav).

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Encounter`, `Combatant` (with `monster` stat block ref, `spent` uses, `legendaryUsed`, `npcId`), `Effect`, `PendingCheck`, `CONDITIONS` |
| `engine.ts` | Every encounter change, pure: turns, timers, concentration, `spendAction` / `rechargeAction` / `spendLegendary` / `critDice` / `isBloodied`. Tested in `engine.test.ts` |
| `hits.ts` | Pure `takeHits(character, hits)`: the player's device applies the DM's live-combat hits once (`Character.appliedHits`). Tested in `hits.test.ts` |
| `ui/useLiveHits.ts` | App hook: watches the live row of each campaign the player brings a character to and saves the hits on that device |
| `campaign.ts` | `campaignRows`: the party in play as `pc` rows, from this device or read from the cloud |
| `npcRows.ts` | Rows that play an NPC sheet (src/npc): `npcCombatant`, `mirrorNpcs` (sheet onto row), `npcChangesFromRows` (row changes back onto the sheet). Tested in `npcRows.test.ts` |
| `storage.ts` | Encounters in localStorage (`ff.encounters.v1`), async API, filtered by `ownerId` |
| `playerView.ts` | Pure: `playerView(encounter)`, what the party may see of a fight (`PlayerEncounter`); `healthLook`, `DM_ONLY_FIELDS`. Tested in `playerView.test.ts` |
| `liveLogic.ts` | Pure battle-map rules: `projectPublic` (what players see of the board), `placeTokens`, `tokenLabel`, `moveProblem`, `moveTokenOn`. Tested in `live.test.ts` |
| `live.ts` | Live combat in Supabase: `startLiveCombat`, `mirrorEncounter`, `setLiveMap`, `updateBoard`, `moveToken`, `endLiveCombat`, `watchLiveCombat`, `pullLiveCombat` |
| `ui/useEncounter.ts` | Loads an encounter and its party characters, saves both, undo; `remote` = characters on players' phones (shown, never written) |
| `ui/apply.ts` | `applyDamage` / `applyHeal` on any row: monsters through the encounter, party members through the sheet engine, remote ones only logged |
| `ui/MonsterActions.tsx` | A monster row's stat block in the fight: one-tap attack + damage with a target picker, save DCs, recharge / X/Day / legendary tracking |
| `ui/rolls.ts` | Initiative and concentration rolls through `src/dice`, recorded in the dice history |
| `ui/CombatTracker.tsx` | Encounter list and the open encounter (`initialOpenId` opens one straight away, used by the DM screen); `campaign` = the party in play; `ui/useMonsterIndex.ts` loads stat blocks; Next turn rolls the new monster's recharges |
| `ui/CombatantRow.tsx`, `AddCombatants.tsx`, `Effects.tsx`, `PendingChecks.tsx` | Parts of the encounter screen |
| `ui/combat.css` | Liquid Glass styles (src/design/DESIGN.md): `.glass` cards, `.glass-btn` buttons, `.glass-chip` chips; logical properties only |
| `ui/style.test.ts` | Keeps `combat.css` on logical properties and glass tokens |

## Rules

- **Party vs monsters.** A `pc` row links a Character: HP, death saves and conditions stay on the character and change through `src/sheet/engine` (`takeDamage`, `heal`, `rollDeathSave`), so the sheet and the tracker always agree. `npc` rows keep their own HP, AC, CON save and conditions.
- **Stat blocks.** A monster row made from the library (`monster: { source, id }`, see src/dm `planCombatants`) unfolds its stat block on its turn (or on "Stat block"): tapping an action rolls to hit and every damage group at once (a natural 20 rolls the damage dice again), shows the result and an "Apply N to <target>" button (half for save-for-half actions). Recharge actions become spent and roll to recharge at the start of the creature's next turn; X/Day actions count down; legendary actions have a 3-pip counter refilled on the creature's turn ("Costs 2 Actions" spends 2). Bloodied is shown at half HP.
- **Campaign party.** With a party in play, "Add the campaign's party" (and the DM screen's Start) adds every character the members bring. One not on this device is read from the cloud and marked "On the player's phone": its HP and conditions show live. Damage or healing to it is queued as a `Hit` on `encounter.hits` (`addHit`, newest 50), which reaches players through `playerView` and the live row; the owner's device applies each hit once (`useLiveHits`), the character syncs back and the tracker shows the new HP.
- **NPC sheets.** A row with `npcId` plays one of the DM's NPC sheets (src/npc, NPC.md). The sheet owns its HP, temp HP, conditions, limited uses and legendary actions: damage, healing and hand-set conditions go through `src/npc/engine` (the block's resistances, immunities and vulnerabilities per damage type, condition immunities refused) via `ui/apply.ts`, and anything else that changes the row through the encounter engine (spending an action, a recharge roll, legendary actions back at the start of its turn) is written back by `npcChangesFromRows`. After every step `mirrorNpcs` copies the sheet onto the row, so turn order, `playerView` and the live row read it like any monster. The row's stat block is the sheet's own block, its name links to `#/npc/<id>`, undo puts the sheet back too, and edits made on the sheet screen show in the fight right away (`onNpcsChanged`). A row whose sheet is gone keeps working as a plain monster row.
- **Order.** Initiative high to low, ties to the higher modifier, then the table can swap tied rows (▲▼). Monsters at 0 HP are skipped; party members at 0 keep their turn for death saves.
- **Timers.** An effect ticks on its source's turn, at the start (default: "1 minute" ends at the start of the caster's 11th turn) or at the end ("until the end of your next turn"; the end of the turn it was cast on does not count). No source: ticks when a new round starts. `remaining: null` lasts until ended. Ending combat ends every effect.
- **Conditions from effects.** An effect's condition shows on its targets. For party members it is written to `character.state.conditions` when the effect starts and removed when it ends (`syncPartyConditions`), so `rules/rollMode` applies it to their rolls. Removing a condition by hand while its effect lasts is allowed.
- **Concentration.** One concentration effect per source; a new one ends the old. Each hit queues a CON save, DC max(10, half the damage). A failed save, 0 HP or an incapacitating condition (incapacitated, paralyzed, petrified, stunned, unconscious) ends it.
- **Text.** UI strings are `combat.*` keys in `src/i18n/locales` (English and Hebrew). Log lines are stored as `{ key, vars }` and translated when shown; plain strings in older saves show as written.
- **Look.** Cards are `.glass` (effects and log `.glass.thick`), one `.glass-btn.prominent` per surface (New encounter, Next turn, Roll save, Add). The active row wears the lens (accent tint, accent edge, accent initiative badge). Damage and heal are tinted glass. High contrast draws 2px edges where state is shown by fill. Phone controls are 44px tall.
- **Undo** restores the encounter and any party characters the step changed.
- **What players may see.** The tracker itself is the DM's. Anything that shows a fight to the party (a pushed battle map, a party-facing initiative list) must go through `playerView(encounter)` and never send the `Encounter`: `npc` rows lose AC, saves and bonuses, show under their `alias` when set, and show a `look` (healthy / bloodied at half HP / down) instead of HP numbers unless `revealHp` is on; `hidden` rows, the effects only they take part in, and their active turn are left out; pending checks and the log stay with the DM. `pc` rows keep `characterId`, since members already read each other's characters. Monster sheets themselves (src/npc) are DM pages (`canOpen('npc')`) with owner-only rows (`npc_sheets`).

## Live combat and the battle map

Design: `/mnt/project-files/combat-maps/brainstorm.md`. The map editor lives in `src/maps` (unit B), the map view in the tracker is unit C, the players' Map tab is unit D; this module is their shared foundation.

- `Encounter.board` (`Board`: `mapId`, `tokens`, `fog` as "x,y" cell keys, `locked`) is the DM's copy of everything on the map that changes during play. A `Token` covers `size × size` cells from `(x, y)`, counted from the top-left corner; `hidden` tokens exist only for the DM. `placeTokens` gives every combatant a token (party along the bottom edge, monsters along the top) so starting a combat needs no placement.
- For a cloud party (`cloudForParty`), `startLiveCombat(partyId, encounter, map)` writes one row per party to `party_encounters` (`20261030210000_party_encounters.sql`): `encounter` (`playerView(encounter)`, so nothing DM-only ever leaves the DM's device), `map` (the full map definition, `LiveMap` is the part this module needs), `board`, `rev`. It is the only way a combat reaches players; the scenario planner (task 4) calls it. `mirrorEncounter` follows every tracker change and never touches the board; `updateBoard` changes fog, lock, hidden and token lists conditionally on `rev`; `endLiveCombat` deletes the row. A local party gets no row and every call returns null or does nothing.
- A trigger keeps `party_encounters_public`, the only table players read: no hidden tokens, no tokens under fog, no tokens of rows players don't see; a combatant whose token is hidden or fogged leaves the turn order too. As a second line of defence a raw npc row (no `look`) loses its HP and the `DM_ONLY_FIELDS` there. `projectPublic` in `liveLogic.ts` is the same rule in TypeScript; `live.test.ts` and `supabase/tests/rls_test.sql` both check it.
- Moves go through the `move_token` RPC (`moveToken`): the DM moves any token; a player only the token whose `characterId` is the character they bring to the party, and not while `locked`; nothing leaves the map. `moveProblem` is the same check client-side for instant feedback. Moves bump `rev`, so a DM board write racing a player move is retried on the fresh board.
- `watchLiveCombat(partyId, asDm, fn)` calls `fn` now and after every realtime change with the row (full for the DM, public for players) or null when the combat ended. Maps are cached by `map_id` so a token move doesn't re-download a picture.
