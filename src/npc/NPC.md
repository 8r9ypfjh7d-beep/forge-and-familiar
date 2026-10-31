# NPC sheets

A named creature the DM runs, built on a monster stat block the way a hero is built on a race and class: "Captain Vexa" is a Bandit Captain with her own name, face, secrets, hit points and play state. NPC sheets are the DM's alone: they live in DM-only storage, never in `characters`, never in party views or the roll feed. Plan: project files `npc-sheets/plan.md`.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `NpcSheet` (owner, campaign, name, role, portrait, notes, `base` reference, `block: Block`, `state`), `NpcState`, `freshState`, `NPC_SCHEMA_VERSION` |
| `engine.ts` | Pure: `newNpc`, `normalize`, damage with vulnerabilities/resistances/immunities and temp HP (`takeDamage`, `npcDefense`), `heal`, `setTempHp`, `setHp`, `setMaxHp`, `setCondition` (refuses immunities), limited actions (`useAction`, `setUses`, `rechargeRoll`), legendary (`spendLegendary`, `useLegendaryResistance`, `startTurn`), spells (`spendSlot`, `spendSpellUse`), `shortRest`, `longRest`, `resetToBook` |
| `store.ts` | `listNpcs(ownerId, partyId?)`, `getNpc`, `saveNpc`, `deleteNpc`, `onNpcsChanged` in `ff.npcs.v1`; `localNpcs` / `applyRemoteNpc` for src/sync |
| `spellcasting.ts` | Pure: `parseSpellcasting` reads a Spellcasting trait (ability, DC, attack, "- Label: spells" groups) into `block.spellcasting`; `spellSaveDc`, `spellAttackBonus`, `spellcastingText`, `spellSlug`, `GROUP_PRESETS` |
| `random.ts` | `randomNpcPick(monsters, pick)`: a humanoid up to CR 5 plus a name, role, quirk and want for the creator's Random NPC |
| `ui/NpcBuilder.tsx` | The creator at `#/npc/new`: Who → Stat block → Tweak → Spells → Review in the hero builder's shell, Random NPC, why? tips (`npc.why.*`). `editing` turns it into Edit mode (play state kept). The Tweak step is the shared `MonsterForm`; saving runs the block through `sanitizeMonsterBlock`. `NpcScreen` is `#/npc/<id>`: the sheet, swapping to the creator when its Edit is tapped |
| `ui/prefill.ts` | `stashNpcPrefill` / `takeNpcPrefill`: what the creator opens with (a library monster, a text NPC from the DM screen, the campaign), handed over once through sessionStorage |
| `ui/npc-builder.css` | Creator styles; logical properties and glass tokens only (checked in `creator.test.ts`) |
| `creator.test.ts` | Spellcasting prefill against SRD blocks, helpers, random pick, prefill handoff, style guards |
| `fixtures.ts` | `makeBlock()`: a test stat block with limited, recharge and legendary actions and spellcasting |
| `npc.test.ts` | Engine rules, against the fixture and SRD 5.1 blocks |
| `ui/NpcSheet.tsx` | The DM's live sheet at `#/npc/<id>` (App renders it only for a DM): hero card (portrait, role, creature line, AC, speed, PB, passive Perception, Initiative roll, Add to fight), HP with damage types through the block's defenses, New turn (legendary back, recharge d6s), legendary pips, conditions (immunities refused), rests, spell slot and per-day pips, the shared `StatBlock` with use pips, DM notes (autosave), session log with Undo, Delete with `ConfirmDialog`. Edit is in place (name, role, max HP) until the creator's edit mode passes `onEdit` |
| `ui/NpcSheetList.tsx` | "NPC sheets" card on the DM screen's NPCs tab (`#/dm/npcs`), for the campaign in play |
| `ui/npc.css`, `ui/style.test.ts` | Sheet styles on the Liquid Glass standard over `.ff-sheet`; logical properties and glass tokens only. Labels in `i18n/locales/npc.en.ts` / `npc.he.ts` |

## Rules

- **The block is a copy.** `block` is the whole `Monster` as the DM wants it (renamed actions, changed AC); `block.hitPoints` is this NPC's max HP. `base` remembers the book entry for "Reset to book" and attribution. A deleted homebrew monster never breaks an NPC.
- **Nothing derived is stored.** Modifiers, slot counts, legendary counts and per-day uses come from `src/monsters/block` at read time; `state` keeps only what was spent.
- **Damage types** read the block's free-text defense lines word by word, like the hero sheet (`rules/damage`): immunity beats resistance beats vulnerability (double). Petrified resists everything. Temp HP goes first.
- **Uses** are keyed by action name; recharge actions hold 1 while spent until `rechargeRoll` meets the minimum. Short rest returns per-rest and recharge actions, long rest returns everything and heals to max.
- **Sheet changes** go through the engine and save at once; Undo puts the previous sheet back. The stat block's Legendary Resistance trait pips are `legendaryResistanceUsed`, not `uses`.
- **Add to fight** lists the DM screen's planned fights first ("Fight 1 (planned)": adds the sheet to that plan through src/dm/store), then the tracker's combats. Picking a combat (or "+ New combat") adds an `npc` row with `npcId` (HP, AC, CON save, initiative bonus from the block) and opens the tracker. UI wording: "fight" for plans, "combat" for the tracker. The tracker (src/combat) keeps that row and the sheet in step: HP, conditions, uses and legendary actions go through this engine (COMBAT.md, `npcRows.ts`). NPCs also join from the tracker's "+ NPC sheet" picker and from a DM screen plan.
- **Cloud.** `saveNpc` / `deleteNpc` mark the outbox; `src/sync/npcs.ts` keeps `npc_sheets` in step (owner or admin only).

## The creator

- **Entry points** (DM screen): the NPC sheets card's "+ New NPC" (`NpcSheetList` `onNew`) and "Give stats" on a text NPC (the text entry leaves the plain list once its sheet is saved); Monsters tab "Make an NPC" on an open stat block. Each stashes a prefill and opens `#/npc/new`.
- **Stat block step** lists `loadMonsters(edition)` (SRD, books grouped by `BOOK_TITLES`, legacy, homebrew packs) in a `ChoicePicker`, with an edition switch shared with the Monsters tab (`src/dm/edition.ts`), a CR cap, "Start from scratch" and "Copy another NPC".
- **Picking a library block** copies it and fills `spellcasting` from its trait, so slots and per-day uses count at once. Saving rewrites the Spellcasting trait text only when the DM changed the spells.
- **HP**: Average (the book's), Roll (`hitPointsRoll` through the dice, lands in the DM's history), or Type. "Reset to book" copies the library block back.
- **Saving** opens the new NPC's sheet; saving an edit returns to it.

## Known tasks

- **Add play state:** add the field to `NpcState` and `freshState`, fill it in `normalize`, reset it in the rests if it recharges.
- **Add a sheet rule:** a pure function in `engine.ts` with a test; the UI only calls it.
