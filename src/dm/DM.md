# DM screen

The Dungeon Master's own page: plan fights against the party's XP budget, look up and roll SRD monsters, a quick-rules screen, and an NPC list with a generator. It never reads players' characters; the DM types the party size and levels.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `DmState` (party groups, encounter plans, NPCs), `emptyDmState` |
| `logic.ts` | Pure: `XP_BUDGET` (SRD 5.2), `partyBudget`, `difficulty`, plan edits, `planCombatants` (tracker hand-off), `findMonsters`, NPC generator with an injected picker, `normalizeDm` |
| `store.ts` | `loadDm` / `saveDm`, localStorage `ff.dm.v1.<userId>` |
| `DmScreen.tsx` | Top card (party and budget tiles) and tabs: Encounters, Monsters, Quick rules, NPCs |
| `dm.css` | Styles; the page sits inside `.ff-sheet` so cards, tabs and titles match the sheet |
| `dm.test.ts` | Budget, difficulty, plans, hand-off, search and generator tests |

## How it works

- **Who sees it.** The "DM screen" chip shows for the DM account (`getSession()?.role === 'dm'`, see src/accounts) and for anyone who runs a party on this device (`party.dmId`). The DM account lands on it after sign-in.
- **Budget.** SRD 5.2 "XP Budget per Character" summed per level group. Difficulty is the plan's total monster XP against Low / Moderate / High (no multiplier for numbers, as in SRD 5.2). Nothing derived is saved.
- **Monsters.** SRD 5.1 library monsters (`loadKind('monsters')`). Stat block bonuses, saves, skills, attacks and damage roll through `useDice`, so they land in the DM's own history. The party roll feed never shows the DM's rolls (watchers are skipped).
- **Run in combat tracker.** Makes an encounter with one `npc` row per creature (average HP, first AC, DEX initiative, CON save) and opens it in src/combat. Players are added there as usual.
- **Quick rules.** DCs, cover, travel pace, light, conditions, and a few rulings, as translated text (keys `dm.ref.*`, `dm.cond.*`). Exhaustion is left out on purpose (removed from the app).
- **NPCs.** Generator picks a made-up name plus a translated role, quirk and want (`dm.npc.*`, sizes in `NPC_TABLES`). Kept NPCs are editable text.

## Known tasks

- **Add a reference panel:** add its keys to both locales and a `RefCard` in `ReferenceTab`.
- **Grow the NPC tables:** add `dm.npc.<table>.<n>` keys in both locales and raise `NPC_TABLES`; the test checks they match.
- **Backend later:** keep the `store.ts` API; DM data is private to the DM.
