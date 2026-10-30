# Sheet modes (story and combat)

The live sheet has two modes, switched with the Story / Combat buttons under the header. Same data; the shared widgets are identical in both modes and sit in the same place. Combat mode never shows the same thing twice.

## Files Covered

| File | Purpose |
|------|---------|
| `mode.ts` | `sheetLayout(mode, { dying })` (pure section order), `useSheetMode` (per-character choice) |
| `mode.test.ts` | Layout tests |
| `components/Story.tsx` | `Notes` |
| `uses.ts` | Pure: `spendResource` (one use of a feature: spent, its effect started, healing), `drinkPotion` |
| `components/Effects.tsx` | `EffectRows` (Effects switches with running spells and features: on casts a known spell like Cast, off ends a running effect, On me chip), `EffectsCard` (story mode), `toggleEffect`, `useSpells` |
| `effects.ts` | Pure: running effects (`state.effects`): `startEffect` (one concentration at a time), `endEffect`, `setEffectOn`, `spendOnceEffects`, `dropSpentTempHp`, `effectsAfterRest`, `endsWithFight`/`endFight` (the End of fight button), `loseConcentration` (taking damage to 0 HP or `setCondition` with an incapacitating condition ends it) |
| `components/HitPoints.tsx` | HP card: amount with Damage/Heal/Temp, an optional damage type (remembered per device in `ff.damageType.v1`) that applies resistances and immunities, then `AfterDamage` and `Conditions` |
| `components/AfterDamage.tsx` | After a hit: concentration save DC with one-tap CON save (a fail ends the spell, undoable), Armor of Agathys reprisal text, Cast for damage reactions (Hellish Rebuke, Absorb Elements; class or race/item spell) |
| `components/Conditions.tsx` | The player's conditions under HP in both modes (`state.conditions`, shared with the DM tracker and read by rollMode): add, ✕, tap for rules text. Exhaustion stays out (removed in PR #19) |
| `components/SpellSlots.tsx` | Slot pips, shown in story's Spells card (`SpellsCard`) and combat's Spells tab (`Spellbook`), both in src/spellbook |
| `combat/` | The combat page (see `combat/COMBAT_PAGE.md`) |
| `../powerup/` | Tamir's Super Saiyan strip card, under the character card on his characters only (see `src/powerup/POWERUP.md`) |

## Layout

- **Shared, identical in both modes**: the character card (`CharacterCard` in `combat/CombatPage.tsx`: portrait and level, class, race and background, XP, AC, speed, proficiency, passive perception, Level Up, Initiative, and the HP and Rest cards), the abilities (`AbilitiesPanel`), and on the side the skills rail (`SkillsPanel`).
- **Story** (default): the Spells card above the skills (`SpellsCard` in src/spellbook: spell slots plus the pinned spells, i.e. the spell entries of `Character.quickCast`, each with Cast), and a main column of notes, Effects (`EffectsCard` in `components/Effects.tsx`: running spells and spell switches, hidden when there are none), attacks and inventory. No resources, ammo and rations, or session log.
- **Combat** main column: Roll20-style tabs: Combat (attacks table with weapons and attack or save spells, pinned ones included; weapon mastery (only when the character has Weapon Mastery, so never under 2014 rules), effects, the player's own actions), Spells (spell slots, the spellbook and, for sorcerers, the Metamagic card from `components/Metamagic.tsx`: sorcery point pips and a Use button per picked option that spends its cost, with a spell-level picker for 2014 Twinned), Inventory (inventory, supplies), Features & Traits (the Resources card with every feature's uses, such as Channel Divinity, superiority dice, Second Wind and custom subclass uses, plus your own trackers, above the features list; sorcery points stay on the Metamagic card), Notes (notes, history). `sheetLayout` returns these as `tabs`. There is no Spells card or quick-cast bar here, since the Spells and Combat tabs already hold slots, spells and their rolls (user ask, 2026-10-27).
- **Combat on phones** (under 820px, `useNarrow()` in `mode.ts`): abilities and skills move into a Checks tab (`PHONE_COMBAT_TABS`), so the tabs sit right under HP and Rest instead of ~2000px down. The tab bar sticks to the top with an HP chip (`HpChip`) that jumps to the HP box and focuses the amount field.
- One tap to use things: Cast on every spell row and on spells from items and race (`src/spellbook/SPELLBOOK.md`), Use on every resource row in the Resources card (spends one; Second Wind rolls its healing, Rage starts its effect and turns its damage switch on), Drink on every potion in the Inventory card (heals, starts its stat effect for an hour, takes one from the stack). Lay on Hands' Use opens an amount picker: Heal me or On an ally. 2014 paladins get a Divine Smite switch under Effects that spends the lowest free slot for the next hit.
- At 0 HP, both modes put death saves on top.
- Rests are one tap in both modes (`components/Rests.tsx`): Short rest applies at once; while hurt, each hit die type gets a one-tap roll. Long rest eats a ration if there is one.

## Rules

- The mode is a device preference in localStorage `ff.sheetMode.v1.<characterId>`, never on `Character`.
- Notes edit `Character.notes` through `setNotes` in `engine.ts`, saved on blur so the history gets one entry per edit.
- A widget meant for both modes goes in `SHARED_TOP` or `SHARED_SIDE` in `mode.ts`. Before adding a card to combat mode, check that no tab already shows it.
- Removing something the player made (a custom action, a tracker, a spell, an item, or the last of a stack) asks first with `sheet.confirmRemove`; switching a running effect off asks with `fx.confirmEnd`, since turning it back on costs a cast. End of fight doesn't ask.
- Adding a sheet section: add its id to `SheetSection`, render it in `CharacterSheet.tsx`'s `section()` switch, and place it in one or both layouts.
- Look: Liquid Glass (`src/design/DESIGN.md`). `sheet.css` makes every `.card` content glass and every `.btn` a capsule for both modes; the shared widgets (character card, abilities, skills) are styled in the top block of `combat/combat.css`, the combat-only parts below its `/* Tabs */` line. New sheet cards get glass from `.card`; inner tiles use `--glass-thin`, `--r-md`/`--r-sm` and `--glass-hairline` separators.
