# Data model

## Files Covered

| File | Purpose |
|------|---------|
| `character.ts` | `Character`, `CharacterState`, `UserProfile`, `ClassLevel`, `HitDie`, `CustomBackground`, `Improvement` |

## What it is

`Character` is what gets saved. It holds choices (race, classes, base scores, chosen skills, inventory) and `state`, the live play state (HP, slots used, resources used, conditions, counters).

Nothing computable is stored: final scores, max HP, AC, slots and resource maxima come from `src/rules`.

- `ownerId` links a character to a `UserProfile`; friends each have their own list.
- `classes` is an array to leave room for multiclassing; the builder creates one entry.
- `state` is owned by the live sheet; the builder only initialises it (`rules/factory.ts`).
- `customActions` (optional) are the player's own actions, bonus actions, reactions, free actions and other abilities on the combat page (`{ id, kind, name, description?, roll?, effect? }`: an optional attack/save roll with dice, and an optional damage effect, optional `stats` (item-effect shape) and `active`, the saved Effects switch that makes the rules engine apply them, and optional `uses` `{ count, recharge }` (a number, `'pb'` or an ability modifier), tracked as resource `act:<id>` so rests refill it); see `src/sheet/combat/COMBAT_PAGE.md`.
- `xp` is added on the sheet (tap the XP line) or by the DM's party awards. `appliedAwards` (optional) holds the ids of party XP awards already added (`src/party/xp.ts`), so each counts once. `hpRolls` (optional) holds hit points rolled at Level Up, keyed `<classId>.<class level>` (`hpRollKey`); levels without one take the average in `getMaxHp`.
- `levelPlan` (optional) is the build planner's route to level 20 (`src/planner/PLANNER.md`): one `PlannedLevel` per future character level (`{ level, classId, subclassId?, abilities?, featId? }`). Only a plan: nothing in it changes stats until the player levels up (Level Up or Edit). Entries at or below the current level are ignored.
- `quickCast` (optional) lists pinned entries; its spell entries are story mode's pinned spells and join combat's attacks table. See `src/quickcast/QUICKCAST.md`.
- `spells` (optional) lists known or prepared spells as `{ id, classId }`, ids from the content library; `spellEdition` (optional, `'2024'` or missing for 2014) picks which SRD's spell lists and counts apply. See `src/spellbook/SPELLBOOK.md`.
- `inventory` entries (`InventoryEntry` in `rules/types.ts`): `itemId`, `qty`, `equipped`, plus optional `item` (the full item, embedded for library and custom items so their stats stay editable), `name`, `notes`, `magicBonus` (+1 to +3), `pact` (one warlock pact weapon), `extraDamage` (e.g. `1d6 fire`), `effects` (stat effects that apply while equipped, see `ItemEffect`). An item's `charges` effect keeps its spent count in `state.resources['item:<uid>']`. All optional, so old saves need no migration. See `src/inventory/INVENTORY.md`.
- `schemaVersion` lets storage migrate old saves.
- Characters of signed-in accounts sync to the cloud (`src/sync/SYNC.md`); `updatedAt` decides which copy wins a conflict.
- Old saves may still hold `state.exhaustion`, `state.inspiration`, `state.attuned` and `state.clock`. Those features were removed; `normalize()` in `sheet/engine.ts` drops the fields on load.
- `state.counters` with `recharge: 'dawn'` are magic item charges; `regain` is dice notation rolled at dawn (blank refills all). Rests never touch them; `dawn()` in `sheet/engine.ts` does.
- `state.effects` (optional) lists what is running on the character: spells cast (Armor of Agathys, Hex, Bless), later features and items too (`LiveEffect`: `id` like `spell:hex`, `name`, `from`, `level`, `concentration`, `on`, `duration`, `ends`, and its numbers: `damage`/`damageType`/`weaponOnly`/`once`, `stats` (item-effect shape), `rollDice`, `acBase`, `acMin`, `reflect`, `whileTempHp`, `self` for range-Self spells that can't be on an ally). Built by `rules/usables.ts`, changed by `sheet/effects.ts`; rests drop what they outlast. Optional, so old saves need no migration.
- `state.supplies` (optional) holds ammo fired since the last battlefield search and hungry days; see `src/supplies/SUPPLIES.md`.
- `rulesEdition` (optional): `'2024'` uses SRD 5.2 rules and content for the whole character; missing means 2014. See `src/rules/RULES.md` (Rules editions). `spellEdition` now only overrides it for spells.
- Builder choices, all optional so old saves stay valid without a schema bump:
  - `backgroundId: 'custom'` with `customBackground` is the PHB custom background (2 skills, 2 tools or languages, a feature name).
  - `chosenLanguages`, `chosenTools`: picks the race, class and background allow. Fixed languages and tools are added by the engine.
  - `traitChoices`: race trait options, e.g. `{ draconicAncestry: 'red' }`; a `Race.choices` pick that takes several options is comma-separated (`{ instincts: 'insight,deception' }`).
  - `sizeChoice`: Small or Medium when the race offers both (`Race.sizeOptions`).
  - `featureChoices`: class choices (2024 Fighting Style/Orders; 2014 Fighting Style, Favored Enemy, Natural Explorer, Tasha's optional features as `use`/`phb`) keyed `<classId>.<choiceId>`, e.g. `{ 'fighter.fightingStyle': 'archery' }`.
  - `classPicks`: class multi-picks keyed `<classId>.<pickId>` → skill ids, e.g. `{ 'rogue.expertise': ['stealth', 'insight'] }`.
  - `weaponMasteries`: 2024 Weapon Mastery weapon item ids, e.g. `['greatsword', 'longbow']`. Missing on older saves: the combat page falls back to equipped weapons.
  - `originFeatId`: a 2024 Human's Origin feat, or the feat of a 2014 subrace with `featChoice` (Variant Human); `'custom'` reads `customOriginFeat` (a full `Feat` the player built).
  - `abilityMethod` is `standard`, `pointBuy`, `rolled` or `manual`. `rolledScores` (optional) keeps the six 4d6-drop-lowest totals the builder rolled, so going back or editing never rerolls them; `baseAbilities` must use each once.
  - `freeAbilityBonuses`: 2014 racial +1 picks (for `flexibleAbilityBonuses` races three +1s), or in 2024 the background's three +1s (an ability twice is +2). Any ability is allowed; the builder warns when a pick is off the book.
  - `racialBonusTargets`: 2014 only, the player moved their race and subrace bonuses (a common table rule). Entry i is where the i-th fixed bonus goes, in `fixedRacialBonuses()` order; missing entries stay where the book puts them.
  - `originSwaps`: 2014 only, Tasha's Customizing Your Origin. `skills`, `languages` and `weapons` (item ids) map each race proficiency to its replacement of the same kind; read through `racialSkills`/`racialLanguages`/`racialWeapons` (`rules/origin.ts`). Kept by Before-edit snapshots.
  - `improvements`: one per Ability Score Improvement the class levels grant: ability bonuses or a `featId` (SRD, book or homebrew), plus `featAbility` for feats with a +1 choice. `featId: 'custom'` reads the improvement's own `customFeat` (`Feat`: effects, sheet stats, uses, armor and weapons).
  - `equipmentPicks`: per class equipment choice, the option taken and the items picked for its "any weapon" slots.
  - `startingWealth`: gold taken instead of gear. 2014 `classGold` (with the d4 `rolls` when rolled) replaces the class and background gear; 2024 `backgroundGold` takes the background's 50 gp instead of its items.
  - `purchases`: gear bought in the builder shop (`Purchase`: `itemId`, optional embedded library `item`, `qty`, total `costCp`). `createCharacter` adds them to the inventory and takes the price from the starting coins.
  - `classes[].subclassId`: SRD, book or homebrew subclass id, or `'custom'` for the player's own one. 2024 saves from before Heroes of Faerûn (`bladesinging`, `knowledge`, `purple-dragon-knight`) are renamed on load (`migrateSubclassIds`); an id that isn't found is kept, never dropped.
  - `customSubclasses` (optional): `SubclassData[]`, at most one per class, read when that class's `subclassId` is `'custom'`. Kept by Before-edit snapshots.
  - `classOptions` (optional): `ClassOptionPick[]` (`{ kind, id, classId?, level?, choice? }`), picks from class option lists (invocations, pact boons, metamagic, maneuvers, infusions...), e.g. `{ kind: 'metamagic', id: 'quickened', classId: 'sorcerer' }`. Ids resolve through `classOptionById(id, edition)` in `rules/classOptions.ts` (2014 and 2024 Metamagic share ids, so switching edition keeps the picks); homebrew ids (`hb:<pack>:<slug>`) stop applying if the pack is removed.
