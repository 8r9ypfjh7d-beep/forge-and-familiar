# NPC sheets

A named creature the DM runs, built on a monster stat block the way a hero is built on a race and class: "Captain Vexa" is a Bandit Captain with her own name, face, secrets, hit points and play state. NPC sheets are the DM's alone: they live in DM-only storage, never in `characters`, never in party views or the roll feed. Plan: project files `npc-sheets/plan.md`.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `NpcSheet` (owner, campaign, name, role, portrait, notes, `base` reference, `block: Block`, `state`), `NpcState`, `freshState`, `NPC_SCHEMA_VERSION` |
| `engine.ts` | Pure: `newNpc`, `normalize`, damage with vulnerabilities/resistances/immunities and temp HP (`takeDamage`, `npcDefense`), `heal`, `setTempHp`, `setHp`, `setMaxHp`, `setCondition` (refuses immunities), limited actions (`useAction`, `setUses`, `rechargeRoll`), legendary (`spendLegendary`, `useLegendaryResistance`, `startTurn`), spells (`spendSlot`, `spendSpellUse`), `shortRest`, `longRest`, `resetToBook` |
| `store.ts` | `listNpcs(ownerId, partyId?)`, `getNpc`, `saveNpc`, `deleteNpc`, `onNpcsChanged` in `ff.npcs.v1`; `localNpcs` / `applyRemoteNpc` for src/sync |
| `fixtures.ts` | `makeBlock()`: a test stat block with limited, recharge and legendary actions and spellcasting |
| `npc.test.ts` | Engine rules, against the fixture and SRD 5.1 blocks |

## Rules

- **The block is a copy.** `block` is the whole `Monster` as the DM wants it (renamed actions, changed AC); `block.hitPoints` is this NPC's max HP. `base` remembers the book entry for "Reset to book" and attribution. A deleted homebrew monster never breaks an NPC.
- **Nothing derived is stored.** Modifiers, slot counts, legendary counts and per-day uses come from `src/monsters/block` at read time; `state` keeps only what was spent.
- **Damage types** read the block's free-text defense lines word by word, like the hero sheet (`rules/damage`): immunity beats resistance beats vulnerability (double). Petrified resists everything. Temp HP goes first.
- **Uses** are keyed by action name; recharge actions hold 1 while spent until `rechargeRoll` meets the minimum. Short rest returns per-rest and recharge actions, long rest returns everything and heals to max.
- **Cloud.** `saveNpc` / `deleteNpc` mark the outbox; `src/sync/npcs.ts` keeps `npc_sheets` in step (owner or admin only). The tracker (src/combat) will link rows by `npcId` and write HP and conditions through this engine.

## Known tasks

- **Add play state:** add the field to `NpcState` and `freshState`, fill it in `normalize`, reset it in the rests if it recharges.
- **Add a sheet rule:** a pure function in `engine.ts` with a test; the UI only calls it.
