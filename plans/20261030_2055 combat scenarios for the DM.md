# Combat scenarios for the DM

Date: 2026-10-30. Owner: thread "Plan combat scenarios for the DM" (task 4 of Ziv's DM-screen list).

## What exists

- DM screen → Encounters tab (`src/dm`): "planned fights" = a list of SRD monsters with counts, SRD 5.2 XP budget meter
  (Low / Moderate / High), "Run in combat tracker" makes a tracker encounter with one row per monster (average HP, AC,
  DEX initiative, CON save) and opens it.
- Initiative tracker (`src/combat`): order, rounds, damage/heal, conditions, timed effects, concentration saves, log,
  undo. Party rows link a Character on this device; monster rows keep their own HP.
- Gaps found: monster rows forget their stat block (no actions, no recharge, no legendary actions in the fight);
  the party has to be added by hand and only from characters stored on the DM's own device, so for a cloud campaign
  (Noa's Garden Gang) the DM cannot add the players at all; initiative for monsters is rolled one by one; nothing
  reaches the players; a plan has no notes and no place for an NPC sheet.

## Design

A **scenario** is the existing `EncounterPlan`, grown: name, monsters (library monsters with counts, or an NPC sheet from
the NPC creator by `npcId`), DM notes (read-aloud text, tactics, loot), an optional battle map (`mapId`, from the maps
thread), and whether monster HP is average or rolled. Difficulty stays SRD 5.2 (budget per character, no multiplier),
shown as a meter plus a sentence like "Moderate for 4 players at level 3". Scenarios sync with the rest of the DM data
(`dm_state`), so they are on every device of the DM.

**Start** (replaces "Run in combat tracker"):
1. Builds the encounter: one row per creature, each carrying `monster: { source, id }` so the tracker has the stat block,
   HP average or rolled, initiative **rolled at once for every monster** (same roll per group, like at a table).
2. Adds the campaign's party by itself: every character the members bring. Characters on this device are linked as
   today; characters that live on a player's phone are loaded read-only from the cloud (members already may read the
   characters other members bring) and shown with their HP, AC and conditions.
3. Opens the tracker with the party waiting for initiative; the DM types it or presses "Roll for all".
4. Calls `startLiveCombat(partyId, encounter, mapId)` from `src/combat/live.ts` (built by the maps thread) when the
   campaign is a cloud one, so the players' phones show the fight. Task 4 builds no second party-visible row.

**Running** (tracker, DM only):
- The active monster's row unfolds its stat block: traits, actions, bonus actions, reactions, legendary actions.
  One tap on an attack rolls to hit (advantage/disadvantage respected) and its damage; the result shows "17 to hit,
  9 slashing → apply to [target]" so the damage lands on a party member in one more tap.
- Multiattack is shown first; recharge actions (5–6) are marked spent and get a recharge roll at the start of the
  monster's turn; X/Day actions count down; legendary actions have a 3-pip counter that refills on the monster's turn;
  save actions show "DC 13 DEX, half on a success" with a damage roll.
- A "stat block" peek for any monster row; "Bloodied" tag at half HP; defeated monsters fold away.
- Damage to a player's character: on this device as today (sheet engine). For a character on a player's phone, the hit
  is written to the live encounter row (`hits[]`) and the player's own device applies it once (`Character.appliedHits`,
  the same idea as XP awards), then the character syncs back and the DM sees the new HP. This needs the live row from
  the maps thread first.

**Players** see the fight through the maps thread's work (turn order, round, "your turn", the map). Nothing extra here.

## Build units

| Unit | Scope | PR |
|------|-------|----|
| 1. Scenarios + stat blocks in the fight | `EncounterPlan` notes/npcId/mapId/rollHp; `Combatant.monster` ref, uses, legendary pips; engine: recharge, per-day, legendary, bloodied; tracker row actions with apply-to-target; DM Encounters tab: Start = monsters rolled + party added (cloud read-only); tests; EN + HE | this thread, now |
| 2. Hits for players' phones | `hits[]` on the encounter, `applyHits` on the player's device, DM sees HP come back | this thread, after the maps thread's `live.ts` lands |
| 3. Map picker on a scenario | `mapId` field + `MapPicker` from `src/maps` | this thread, after the maps thread's editor lands |

Contracts agreed with other threads: NPC sheets → `Combatant.npcId`, `PlanMonster.npcId` (count 1); maps →
`startLiveCombat(partyId, encounter, mapId?)`, one `party_encounters` row; monster list → more `loadKind('monsters')`
sources, the `Monster` type stays, so the planner picks them up with no change.
