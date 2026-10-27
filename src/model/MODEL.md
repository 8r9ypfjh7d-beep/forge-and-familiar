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
- `customActions` (optional) are the player's own actions, bonus actions, reactions, free actions and other abilities on the combat page (`{ id, kind, name, description?, roll?, effect? }`: an optional attack/save roll with dice, and an optional damage effect, optional `stats` (item-effect shape) and `active`, the saved Effects switch that makes the rules engine apply them); see `src/sheet/combat/COMBAT_PAGE.md`.
- `quickCast` (optional) lists the entries pinned to the sheet's quick-cast bar (its spell entries are also story mode's Spells card); see `src/quickcast/QUICKCAST.md`.
- `spells` (optional) lists known or prepared spells as `{ id, classId }`, ids from the content library; `spellEdition` (optional, `'2024'` or missing for 2014) picks which SRD's spell lists and counts apply. See `src/spellbook/SPELLBOOK.md`.
- `inventory` entries (`InventoryEntry` in `rules/types.ts`): `itemId`, `qty`, `equipped`, plus optional `item` (the full item, embedded for library and custom items so their stats stay editable), `name`, `notes`, `magicBonus` (+1 to +3), `pact` (one warlock pact weapon), `extraDamage` (e.g. `1d6 fire`), `effects` (stat effects that apply while equipped, see `ItemEffect`). All optional, so old saves need no migration. See `src/inventory/INVENTORY.md`.
- `schemaVersion` lets storage migrate old saves.
- Characters of signed-in accounts sync to the cloud (`src/sync/SYNC.md`); `updatedAt` decides which copy wins a conflict.
- Old saves may still hold `state.exhaustion`, `state.inspiration`, `state.attuned` and `state.clock`. Those features were removed; `normalize()` in `sheet/engine.ts` drops the fields on load.
- `state.counters` with `recharge: 'dawn'` are magic item charges; `regain` is dice notation rolled at dawn (blank refills all). Rests never touch them; `dawn()` in `sheet/engine.ts` does.
- `state.supplies` (optional) holds ammo fired since the last battlefield search and hungry days; see `src/supplies/SUPPLIES.md`.
- `rulesEdition` (optional): `'2024'` uses SRD 5.2 rules and content for the whole character; missing means 2014. See `src/rules/RULES.md` (Rules editions). `spellEdition` now only overrides it for spells.
- Builder choices, all optional so old saves stay valid without a schema bump:
  - `backgroundId: 'custom'` with `customBackground` is the PHB custom background (2 skills, 2 tools or languages, a feature name).
  - `chosenLanguages`, `chosenTools`: picks the race, class and background allow. Fixed languages and tools are added by the engine.
  - `traitChoices`: race trait options, e.g. `{ draconicAncestry: 'red' }`.
  - `featureChoices`: 2024 class picks keyed `<classId>.<choiceId>`, e.g. `{ 'fighter.fightingStyle': 'archery' }`.
  - `originFeatId`: a 2024 Human's Origin feat.
  - `freeAbilityBonuses`: 2014 racial +1 picks, or in 2024 the background's three +1s (an ability twice is +2).
  - `improvements`: one per Ability Score Improvement the class levels grant: ability bonuses or a `featId` (SRD or homebrew), plus `featAbility` for feats with a +1 choice.
  - `equipmentPicks`: per class equipment choice, the option taken and the items picked for its "any weapon" slots.
  - `classes[].subclassId`: SRD or homebrew subclass.
