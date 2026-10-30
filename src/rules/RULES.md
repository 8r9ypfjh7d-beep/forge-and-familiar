# Rules engine

Pure functions over a `Character`. No React, storage or dice. Import from `src/rules` (index.ts).

## Files Covered

| File | Purpose |
|------|---------|
| `index.ts` | Public API re-exports |
| `types.ts` | Rule definitions: abilities, races, classes, items, conditions |
| `abilities.ts` | Modifiers, standard array, point buy, racial bonuses (`fixedRacialBonuses`: 2014 race/subrace bonuses, moved by `racialBonusTargets`), final scores |
| `origin.ts` | Tasha's Customizing Your Origin (2014): `bookOrigin`, `racialSkills`, `racialLanguages`, `racialWeapons` apply `Character.originSwaps`; `canSwapOrigin` |
| `derive.ts` | `derive()` and helpers: HP, hit dice, AC, attacks, saves, skills, slots, resources, speed |
| `factory.ts` | `createCharacter(draft)`, `freshState(maxHp)`, starting kit |
| `rollMode.ts` | Advantage/disadvantage from own conditions |
| `attackRiders.ts` | `getDamageRiders` (Rage, Sneak Attack) and `getCritRange` (Champion) for one-tap attacks |
| `choices.ts` | ASI slots and feats, languages, tools, starting-gear choices (`classKit`) |
| `edition.ts` | `rulesEdition(c)` ('2014' or '2024') and `uses2024Spells(c)` |
| `multiclass.ts` | Prerequisites, multiclass proficiencies, caster level breakdown, per-class spell DCs, multiclass warnings |
| `subclass.ts` | `subclassOf(c, cl)` (official, homebrew or the character's custom subclass), `activeSubclasses`, `subclassFeatures`, `subclassEffects`, `subclassSpellNames` |
| `classOptions.ts` | Shared registry of class option lists (invocations, pact boons, metamagic, maneuvers, fighting styles, infusions, and any other kind): `registerClassOptions(origin, list)`, `classOptions(kind, edition)`, `classOptionById(id, edition)`, `homebrewClassOptions`, `pickedClassOptions`, `classOptionEffects` |
| `data/books/subclasses.ts` | Subclasses from official books outside the SRD (`BOOK_SUBCLASSES`, `BOOK_SUBCLASSES_2024`) for every class: names, levels and mechanics only; feature text is our own summary in `explain.books.*.ts` (warlock) and `explain.classes.*.ts` (the rest) |
| `data/books/martial.ts`, `casters.ts` | Barbarian/fighter/monk/rogue and the caster classes' book subclasses (2014, 2024, and `*_REWRITTEN` ids that 2024 redid so they are not also offered as legacy) |
| `data/books/helpers.ts` | Builders for the book data: source names, `f` (feature), `short`/`long` uses, `fx`, `resist`, `dark`, `move`, `fullSpells`/`halfSpells`/`spells2024`, `legacy` |
| `data/classFeatures2014.ts` | `FEATURES_2014`: every 2014 class feature from level 1 to 20, with `effects` (sheet changes) and `detail` steps (what grows with level) |
| `data/*.ts` | SRD 5.1 content: races, classes, `subclasses.ts` (one SRD per class, listed first), `feats.ts` (Grappler), `backgrounds.ts` (Acolyte + custom), `proficiencies.ts` (languages, tools), items |
| `data/srd52/*.ts` | SRD 5.2 (2024) content: `SPECIES`, `CLASSES_2024`, `SUBCLASSES_2024`, `BACKGROUNDS_2024`, `FEATS_2024` |
| `rules.test.ts`, `multiclass.test.ts`, `choices.test.ts`, `srd52.test.ts`, `classFeatures.test.ts` | Engine tests |

## Rules editions (2014 and 2024)

Each character picks its rules with `Character.rulesEdition` (`'2024'`, or missing for 2014). Lookups take the edition: `raceById(id, edition)`, `classById`, `subclassById`, `subclassesFor`, `backgroundById`, `featById`, `allRaces`, `allFeats`, `classesFor`, `backgroundsFor`. Without one they return SRD 5.1. Ids are shared where the thing is the same (`fighter`, `dwarf`, `acolyte`); 2024 subclass ids match the content library (`college-of-lore`). Homebrew races, subclasses and feats are offered with both editions; homebrew backgrounds only in the editions their author picked.

2024 differences the engine applies:
- Origin: species give no ability bonuses or languages. The background lists three abilities as the suggestion; `freeAbilityBonuses` holds one entry per +1 on any ability (`backgroundBonuses`: at most +2 to one, +3 in total). Backgrounds teach Common + 2 picked languages and grant an Origin feat (`Background.feat`, shown as "Magic Initiate (Cleric)"). A Human also picks one (`Character.originFeatId`).
- `getFeats(c)` = (any edition) a homebrew background's `effects` as one feat-like entry + background feat + Human's feat + Fighting Style feats + ASI feats. Feat effects: `initiativeProficiency` (Alert), `skillPicks` (Skilled), `abilityChoice` (Grappler, Epic Boons up to 30; the pick is `Improvement.featAbility`), `rangedAttack` (Archery), `armoredAc` (Defense).
- Class choices (`ClassDef.choices`, saved in `Character.featureChoices` as `<classId>.<choiceId>`): Fighting Style (feat options), Divine Order and Primal Order (extra armor and weapon proficiencies). `classChoices(c)` lists them; picks show in `features` as "Divine Order (Protector)".
- Classes: subclass at 3, Epic Boon slot at 19, 2024 resources (Second Wind uses, Indomitable, Focus Points, Favored Enemy...), Monk and Rogue Light/Finesse martial weapons, Martial Arts d6 to d12, Draconic Sorcery 10 + DEX + CHA. `getWeaponMasteryCount(c)` reads `ClassDef.weaponMastery`.
- Half casters get slots from level 1 and always round their levels up (also when multiclassed). Multiclass grants come from `MULTICLASS_PROFICIENCIES_2024`.
- Starting gear is the class's option A kit with its coins or option B coins only (`EquipmentChoice` options carry `gold`); `startingGold` adds the background's coins. 2014 characters start with 15 gp plus a homebrew background's gold.
- Not modelled yet: Weapon Mastery picks, Eldritch Invocations, Expertise and Metamagic picks, Elf Keen Senses limited to three skills (any skill is accepted), Skilled's tool option, Heroic Inspiration, background option B (50 gp).
- Older saves that only set `spellEdition: '2024'` keep 2014 rules; `uses2024Spells` still gives their pact weapon CHA.

## Key rules implemented

- HP: max hit die at level 1, fixed average after, + CON per level, Hill Dwarf +1/level. `baseMaxHp` equals `maxHp` (kept for older callers).
- AC: armor + capped DEX, shield +2, Barbarian/Monk unarmored defense (Monk loses it with a shield), + `magicBonus` of equipped armor and shield.
- Item effects (`itemEffects.ts`): an equipped entry's `effects` (and a switched-on custom action's `stats`) apply while it is equipped (the app has no attunement). `effectsOf(c, kind)` lists them with their source; `sanitizeEffect` reads one from outside (shared DM requests).
  - Ability effects apply in `getAbilityScores` (after the 20 cap, so a belt can raise STR to 29).
  - Flat bonuses: AC (`unarmored` only without armor or shield), every save, every skill and initiative (`checks`), weapon attack and damage (`only` melee or ranged), initiative, spell DC and attack, speed, max HP (`hp`, inside `getMaxHp`), passive Perception.
  - One save or skill (`save`, `skill`), proficiency in one (`saveProficiency`, `skillProficiency` with `expertise`).
  - `advantage` on a skill, a save, all saves, all checks, initiative, attacks or concentration. Without `when` it sets `advantage` on `DerivedStats.saves`/`.skills`, `initiativeAdvantage` or `checkAdvantage`, and src/dice rolls it; with `when` it is only listed in `DerivedStats.advantages`.
  - `resistance`, `immunity`, `conditionImmunity` → `DerivedStats.defenses`; `moveSpeed` (0 = walking speed) → `.speeds`; `sense` → `.senses`; `spell` → `.itemSpells`.
  - `spellSlot` and `pactSlot` add to `getSpellSlots`. `charges` become resources from `getResources` with id `item:<uid>` (recharge short, long, dawn with `regain` dice, or none).
  - `src/explain/math.ts` lists each item as its own line. SRD defaults per magic item are in `data/magicItemEffects.ts` (dawn wands and staffs get their charges and spells from `data/dawnItems.ts`).
- Custom actions (`Character.customActions`) switched on (`active`) add their `stats` through the same item-effect path, labelled with the action's name. Bonus kinds `attack` and `damage` apply to weapon attacks and the unarmed strike; `initiative` to initiative.
- Items: always resolve an inventory entry with `entryItem(e)`: it uses the entry's embedded `item` (library or custom items), else `itemById`, and applies the `name` override.
- Attacks: finesse uses better of STR/DEX, ranged uses DEX, Monk martial arts, proficiency from class and race. Each attack carries `versatile` (two-handed damage) and `properties`. Riders: Rage +2/+3/+4 on STR melee, Sneak Attack ⌈rogue level ÷ 2⌉d6 on finesse or ranged (the player toggles them). Champion crits on 19 (level 3) or 18 (level 15). Magic weapons add `magicBonus` to attack and damage and `extraDamage` rides along. A `pact` weapon is always proficient and, with `spellEdition: '2024'`, uses CHA when it is higher.
- XP: `XP_THRESHOLDS` (SRD) and `xpForNextLevel(level)`.
- Attack rows also carry `itemId`, `reach` (5, or 10 with reach; missing for ranged weapons) and `range` ("20/60").
- Slots: full/half caster tables (single half caster rounds up from level 2), multiclass caster level, Warlock pact slots.
- Resources: per-class maxima by level; `recharge` resolved for level (e.g. Bardic Inspiration short rest from 5).
- Speed: heavy armor STR requirement, Monk/Barbarian movement.
- Saving throw proficiencies come from the first class only.
- Class features (`ClassFeature`, both editions): `effects` (any `ItemEffect`) apply from the feature's level through `activeItemEffects` as `classEffects`, labelled with the feature name (Diamond Soul and Disciplined Survivor save proficiencies, Feral Instinct, Danger Sense, Purity of Body, Aura of Courage, Blindsense, Slippery Mind, Primal Champion and Body and Mind +4). `detail` steps (`featureDetail`) give `DerivedStats.features[].detail` ("d8", "CR 1", "3 attacks"); the UI translates it with `term('detail', …)`.
  - Aura of Protection (paladin 6): CHA modifier, min +1, on every save (`auraOfProtection`, also a "show the math" line). Improved Divine Smite / Radiant Strikes (paladin 11): melee weapon attacks get `extraDamage` 1d8 radiant (a note when the weapon has its own). Brutal Critical (2014 barbarian 9/13/17) and Ki-Empowered Strikes (2014 monk 6) are attack notes.
  - 2014 resources added for levels 6–20: Indomitable, Divine Intervention, Cleansing Touch, Mystic Arcanum 6th–9th, Eldritch Master, Stroke of Luck, Signature Spells; Wild Shape is unlimited (99) at 20 like Rage.
- Subclasses (`SubclassData`): features join `features` from `subclassLevel`; Life Domain adds heavy armor; Draconic Bloodline adds 1 HP per sorcerer level and 13 + DEX unarmored AC.
  - A feature's `uses` (number, `'pb'`, `'level'` or an ability modifier, times `mult`, + `add`, min 1; `steps: [[level, count]]` overrides the count by class level) becomes a resource `sub:<subclassId>:<slug>`; its `effects` (any `ItemEffect`) apply from its level through `activeItemEffects`, labelled with the feature name.
  - `armor`/`weapons` add proficiencies, `spells` (names by class level) are always prepared (the spellbook resolves names in the library and skips missing ones), `castingWeapon` lets pact weapons use CHA under 2014 rules (Hex Warrior).
  - Lists: SRD subclass first, then the books' subclasses, then homebrew. 2014-only books' subclasses are offered in 2024 with level 1–2 features moved to the subclass level (`legacy`).
  - `subclassId: 'custom'` (`CUSTOM_SUBCLASS`) reads `Character.customSubclasses` for that class; always resolve with `subclassOf`, not `subclassById`.
- ASIs and feats (`improvements`) add to ability scores (cap 20). Feat effects apply: ability, skill, HP per level, speed, initiative, AC. `DerivedStats.feats`, `.tools`, `.languages` list them.
- Backgrounds go through `getBackground(c)`, which also builds the PHB custom background.
- Homebrew: `registerHomebrewRaces` (subraces attach to their parent), `registerHomebrewSubclasses`, `registerHomebrewFeats`, `registerHomebrewBackgrounds` (each with its `editions`; in 2014 their ability scores and Origin feat are dropped), like `registerHomebrewItems`. SRD ids always win. Use `allRaces()` for lists; `RACES` is SRD only.
- Multiclass (SRD 5.1, `data/multiclass.ts`): ability prerequisites for the new class and every current one; later classes grant only their multiclass armor/weapon proficiencies; Unarmored Defense comes from the first class that has it; Channel Divinity uses don't add up. `derive().warnings` carries unmet prerequisites, level over 20, Extra Attack/Unarmored Defense/Channel Divinity not stacking, separate spell lists and pact slots, and the extra skill Bard/Ranger/Rogue grant (not yet pickable).

## Stable API (used by the sheet and dice)

`derive`, `getMaxHp`, `getHitDice`, `getResources`, `getSpellSlots`, `getArmorClass`, `getAttacks`, `getRollMode`, `autoFailsSave`, `createCharacter`, `freshState`, `getCasterLevel`, `getSpellcastingByClass`, `addClassIssues`, `meetsPrereq`. Field names on `DerivedStats` (`saves`, `skills`, `attacks`, `initiative`) are relied on by `src/dice`.

## Class options

Option lists a class or subclass picks from share one shape, `ClassOption` (`classOptions.ts`). Each feature thread registers its official list under its own origin (`'invocations'`, `'metamagic'`, `'subclass'`, `'artificer'`...); homebrew packs register under `'homebrew'`, listed last. Pickers list `classOptions(kind, edition)` and filter by `classIds`, `subclassIds` and `minLevel`; saved ids resolve through `classOptionById(id, edition)`, which prefers that edition's entry when 2014 and 2024 share an id.

- Picks are saved in `Character.classOptions` (`{ kind, id, classId?, level?, choice? }`). 2014 and 2024 fighting styles are the exception: they stay in `featureChoices`, and the picker appends `classOptions('fightingStyle')` to the Fighting Style pool.
- A picked option's `effects`, its `later` effects from their class level, and its `spells` (as `spell` effects, from their level) apply through `activeItemEffects`, labelled with the option name. `uses` (same shape as subclass feature uses, counted from the picking class's level) become a resource `opt:<optionId>`.
- `cost` (+ `costPerSpellLevel`) is the points it spends; `repeatable` options may be picked more than once; `choiceKind` says what a pick's `choice` names.
